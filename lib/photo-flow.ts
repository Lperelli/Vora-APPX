import { poseQualityIssue } from './pose-quality'
import type { BodyWidths } from '@/lib/body-classifier'
import { PHOTO_VISIBILITY, THRESHOLDS } from '@/lib/body-type-config'
import { asset } from '@/lib/base-path'
import { POSE_MODEL_PATH, visionFileset } from './vision-assets'
import { preparePhoto, type PreparedPhoto } from './photo-image'

/**
 * VORA — Photo flow (100% client-side, no upload).
 *
 * A photo is processed entirely in the browser with MediaPipe PoseLandmarker
 * (Full model + segmentation mask). We read silhouette widths at the shoulder,
 * waist and hip rows, turn them into scale-invariant ratios, and hand them to
 * the shared `classifyBodyType`. The decoded image is discarded immediately and
 * never leaves the device.
 *
 * Versions are pinned (no `latest`) per spec. The model `.task` is shipped
 * with VORA; the WASM runtime is shipped from the same pinned package version.
 */

// BlazePose landmark indices.
const L_SHOULDER = 11
const R_SHOULDER = 12
const L_HIP = 23
const R_HIP = 24

export type PhotoFailReason =
  | 'not_front_facing'
  | 'arms_obscured'
  | 'posture'
  | 'no_body'
  | 'multiple_bodies'
  | 'not_full_body'
  | 'low_visibility'
  | 'silhouette_unreadable'
  | 'image_decode_failed'
  | 'load_failed'

export interface PhotoMeasureResult {
  ok: boolean
  widths: BodyWidths | null
  visibility: number
  reason?: PhotoFailReason
}

/** One analysis owns one model; camera retries cannot accumulate WebGL contexts. */
export function createPhotoAnalyzer() {
  let closed = false
  let model: import('@mediapipe/tasks-vision').PoseLandmarker | null = null
  let pending: Promise<
    import('@mediapipe/tasks-vision').PoseLandmarker
  > | null = null
  let canvas: HTMLCanvasElement | null = null
  const dispose = () => {
    closed = true
    try {
      model?.close?.()
    } catch {
      /* A lost context may already be closed. */
    }
    model = null
    if (canvas) {
      try {
        canvas
          .getContext?.('webgl2')
          ?.getExtension('WEBGL_lose_context')
          ?.loseContext()
      } catch {
        /* Already released. */
      }
      canvas.width = canvas.height = 1
      canvas = null
    }
  }
  const getLandmarker = () => {
    if (closed)
      return Promise.reject(new DOMException('Analysis closed', 'AbortError'))
    if (!pending) {
      let timeout: ReturnType<typeof setTimeout>
      const initialization = (async () => {
        const { FilesetResolver, PoseLandmarker } = await import(
          '@mediapipe/tasks-vision'
        )
        const fileset = visionFileset(await FilesetResolver.isSimdSupported())
        if (closed) throw new DOMException('Analysis closed', 'AbortError')
        for (const delegate of ['GPU', 'CPU'] as const) {
          canvas = document.createElement('canvas')
          const currentCanvas = canvas
          try {
            const instance = await PoseLandmarker.createFromOptions(fileset, {
              canvas: currentCanvas,
              baseOptions: { modelAssetPath: asset(POSE_MODEL_PATH), delegate },
              runningMode: 'IMAGE',
              numPoses: 2,
              outputSegmentationMasks: true,
            })
            if (closed) {
              instance.close()
              throw new DOMException('Analysis closed', 'AbortError')
            }
            model = instance
            return instance
          } catch (error) {
            currentCanvas.width = currentCanvas.height = 1
            canvas = null
            if (closed || delegate === 'CPU') throw error
          }
        }
        throw new Error('Analysis could not start')
      })()
      pending = Promise.race([
        initialization,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            dispose()
            reject(new Error('Photo analysis download timed out'))
          }, 45000)
        }),
      ])
        .catch((error) => {
          pending = null
          throw error
        })
        .finally(() => clearTimeout(timeout))
    }
    return pending
  }
  return {
    dispose,
    measure: (file: File | Blob) => measureImage(file, getLandmarker),
  }
}

export async function measureFromImage(
  file: File | Blob
): Promise<PhotoMeasureResult> {
  const analyzer = createPhotoAnalyzer()
  try {
    return await analyzer.measure(file)
  } finally {
    analyzer.dispose()
  }
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1)
}

/** Read the torso's contiguous segment near its pose centre, excluding detached arms. */
function silhouetteWidth(mask: Float32Array, width: number, height: number, yRow: number, centerX: number): number {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || mask.length !== width * height || !Number.isFinite(centerX) || centerX < 0 || centerX > 1) return 0
  const center = Math.min(width - 1, Math.round(centerX * width))
  const rows: number[] = []
  for (let offset = -2; offset <= 2; offset++) {
    const y = Math.round(yRow) + offset
    if (y < 0 || y >= height) continue
    const base = y * width
    const human = (x: number) => x >= 0 && x < width && mask[base + x] > 0.5
    let anchor = center
    // Tolerate a tiny centre discrepancy, but never jump to a detached limb.
    if (!human(anchor)) {
      const radius = Math.max(1, Math.round(width * 0.02))
      let found = false
      for (let d = 1; d <= radius; d++) {
        if (human(center - d)) { anchor = center - d; found = true; break }
        if (human(center + d)) { anchor = center + d; found = true; break }
      }
      if (!found) continue
    }
    let left = anchor; let right = anchor
    while (human(left - 1)) left--
    while (human(right + 1)) right++
    rows.push(right - left + 1)
  }
  if (rows.length < 3) return 0
  rows.sort((a, b) => a - b)
  return rows[Math.floor(rows.length / 2)]
}

/**
 * Measure body silhouette widths from a single image. Returns ok:false with a
 * reason when the photo is unusable (no body, partial body, low confidence,
 * unreadable silhouette) so the UI can offer retry / manual entry.
 */
async function measureImage(file: File | Blob, getLandmarker: () => Promise<unknown>): Promise<PhotoMeasureResult> {
  let landmarker: {
    detect: (img: HTMLCanvasElement) => {
      landmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>
      segmentationMasks?: Array<{ width: number; height: number; getAsFloat32Array: () => Float32Array; close?: () => void }>
    }
  }
  let photo: PreparedPhoto

  try {
    photo = await preparePhoto(file)
  } catch {
    return { ok: false, widths: null, visibility: 0, reason: 'image_decode_failed' }
  }

  try {
    landmarker = (await getLandmarker()) as typeof landmarker
  } catch (error) {
    photo.dispose()
    console.warn('[Vora photo] Analysis could not start:', error instanceof Error ? error.message : 'Unknown initialization error')
    return { ok: false, widths: null, visibility: 0, reason: 'load_failed' }
  }

  let masks: Array<{ close?: () => void }> = []
  try {
    const result = landmarker.detect(photo.image)
    masks = result.segmentationMasks || []
    if ((result.landmarks?.length || 0) > 1) return { ok: false, widths: null, visibility: 0, reason: 'multiple_bodies' }
    const lm = result.landmarks?.[0]
    if (!lm) return { ok: false, widths: null, visibility: 0, reason: 'no_body' }

    const keyPoints = [lm[L_SHOULDER], lm[R_SHOULDER], lm[L_HIP], lm[R_HIP]]
    const visibility = avg(keyPoints.map((p) => p?.visibility ?? 0))
    if (keyPoints.some(point => !point || !Number.isFinite(point.y) || !Number.isFinite(point.x))) return { ok: false, widths: null, visibility: 0, reason: 'not_full_body' }
    if (visibility < PHOTO_VISIBILITY.low) return { ok: false, widths: null, visibility, reason: 'low_visibility' }
    const nose = lm[0]
    const ankles = [lm[27], lm[28]]
    if (!nose || !Number.isFinite(nose.y) || (nose.visibility ?? 0) < 0.4 || nose.y < 0.01 || ankles.some(point => !point || !Number.isFinite(point.y) || point.y > 0.99 || (point.visibility ?? 0) < 0.35)) {
      return { ok: false, widths: null, visibility, reason: 'not_full_body' }
    }

    const qualityIssue = poseQualityIssue(lm)
    if (qualityIssue) return { ok: false, widths: null, visibility, reason: qualityIssue }

    const mask = result.segmentationMasks?.[0]
    if (!mask) return { ok: false, widths: null, visibility, reason: 'silhouette_unreadable' }

    const W = mask.width
    const H = mask.height
    const data = mask.getAsFloat32Array()

    const yShoulder = ((lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2) * H
    const yHip = ((lm[L_HIP].y + lm[R_HIP].y) / 2) * H
    const yWaist = yShoulder + (yHip - yShoulder) * THRESHOLDS.waistRowFactor

    const shoulderCenter = (lm[L_SHOULDER].x + lm[R_SHOULDER].x) / 2
    const hipCenter = (lm[L_HIP].x + lm[R_HIP].x) / 2
    const waistCenter = shoulderCenter + (hipCenter - shoulderCenter) * THRESHOLDS.waistRowFactor
    const shoulderW = silhouetteWidth(data, W, H, yShoulder, shoulderCenter)
    const waistW = silhouetteWidth(data, W, H, yWaist, waistCenter)
    const hipW = silhouetteWidth(data, W, H, yHip, hipCenter)

    // Full body must be in frame: shoulders well below the top, hips above the bottom.
    const shoulderNorm = (lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2
    const hipNorm = (lm[L_HIP].y + lm[R_HIP].y) / 2
    if (shoulderNorm < 0.02 || hipNorm > 0.98) {
      return { ok: false, widths: null, visibility, reason: 'not_full_body' }
    }

    if (!(shoulderW > 0 && waistW > 0 && hipW > 0)) {
      return { ok: false, widths: null, visibility, reason: 'silhouette_unreadable' }
    }

    return { ok: true, widths: { shoulderW, waistW, hipW, visibility }, visibility }
  } catch {
    return { ok: false, widths: null, visibility: 0, reason: 'silhouette_unreadable' }
  } finally {
    masks.forEach(mask => { try { mask.close?.() } catch { /* Already released/lost context. */ } })
    photo.dispose()
  }
}
