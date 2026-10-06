import { poseQualityIssue } from './pose-quality'
import type { BodyWidths } from '@/lib/body-classifier'
import { PHOTO_VISIBILITY, THRESHOLDS } from '@/lib/body-type-config'
import { asset } from '@/lib/base-path'

/**
 * VORA — Photo flow (100% client-side, no upload).
 *
 * A photo is processed entirely in the browser with MediaPipe PoseLandmarker
 * (Full model + segmentation mask). We read silhouette widths at the shoulder,
 * waist and hip rows, turn them into scale-invariant ratios, and hand them to
 * the shared `classifyBodyType`. The image bitmap is discarded immediately and
 * never leaves the device.
 *
 * Versions are pinned (no `latest`) per spec. The model `.task` is shipped
 * with VORA; the WASM runtime is loaded from the same pinned package version.
 */

// Webflow Cloud treats public `.wasm` files as Worker modules and rejects the
// deployment when all MediaPipe variants are bundled. Keep only the 9 MB model
// local and fetch the version-pinned runtime from jsDelivr. This URL must stay
// in sync with the exact @mediapipe/tasks-vision version in package.json.
export const POSE_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
export const POSE_MODEL_PATH = '/models/pose_landmarker_full.task'

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
  | 'load_failed'

export interface PhotoMeasureResult {
  ok: boolean
  widths: BodyWidths | null
  visibility: number
  reason?: PhotoFailReason
}

// Cache the landmarker across calls (loading WASM + model is expensive).
let landmarkerPromise: Promise<unknown> | null = null

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(asset(POSE_WASM_BASE))
      const makeOptions = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: asset(POSE_MODEL_PATH), delegate },
        runningMode: 'IMAGE' as const,
        numPoses: 2,
        outputSegmentationMasks: true,
      })
      try {
        return await PoseLandmarker.createFromOptions(fileset, makeOptions('GPU'))
      } catch {
        // Some browsers / sandboxes lack WebGL — fall back to CPU.
        return PoseLandmarker.createFromOptions(fileset, makeOptions('CPU'))
      }
    })().catch(error => {
      landmarkerPromise = null
      throw error
    })
  }
  return landmarkerPromise
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
export async function measureFromImage(file: File | Blob): Promise<PhotoMeasureResult> {
  let landmarker: {
    detect: (img: ImageBitmap) => {
      landmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>
      segmentationMasks?: Array<{ width: number; height: number; getAsFloat32Array: () => Float32Array; close?: () => void }>
    }
  }
  let bitmap: ImageBitmap

  try {
    landmarker = (await getLandmarker()) as typeof landmarker
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, widths: null, visibility: 0, reason: 'load_failed' }
  }

  let masks: Array<{ close?: () => void }> = []
  try {
    const result = landmarker.detect(bitmap)
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
    masks.forEach(mask => mask.close?.())
    bitmap.close()
  }
}
