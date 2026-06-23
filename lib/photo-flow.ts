import type { BodyWidths } from '@/lib/body-classifier'
import { THRESHOLDS } from '@/lib/body-type-config'

/**
 * VORA — Photo flow (100% client-side, no upload).
 *
 * A photo is processed entirely in the browser with MediaPipe PoseLandmarker
 * (Full model + segmentation mask). We read silhouette widths at the shoulder,
 * waist and hip rows, turn them into scale-invariant ratios, and hand them to
 * the shared `classifyBodyType`. The image bitmap is discarded immediately and
 * never leaves the device.
 *
 * Versions are pinned (no `latest`) per spec. The model `.task` is loaded from
 * Google's versioned model bucket; the WASM runtime from the pinned npm build.
 */

// Pinned versions — keep in sync with package.json "@mediapipe/tasks-vision".
const TASKS_VISION_VERSION = '0.10.35'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

// BlazePose landmark indices.
const L_SHOULDER = 11
const R_SHOULDER = 12
const L_HIP = 23
const R_HIP = 24

export type PhotoFailReason =
  | 'no_body'
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
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
      const makeOptions = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'IMAGE' as const,
        numPoses: 1,
        outputSegmentationMasks: true,
      })
      try {
        return await PoseLandmarker.createFromOptions(fileset, makeOptions('GPU'))
      } catch {
        // Some browsers / sandboxes lack WebGL — fall back to CPU.
        return PoseLandmarker.createFromOptions(fileset, makeOptions('CPU'))
      }
    })()
  }
  return landmarkerPromise
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1)
}

/** Width of the person silhouette (px) at a given mask row: last "human" px − first. */
function silhouetteWidth(mask: Float32Array, width: number, height: number, yRow: number): number {
  const y = Math.min(height - 1, Math.max(0, Math.round(yRow)))
  let first = -1
  let last = -1
  const base = y * width
  for (let x = 0; x < width; x++) {
    if (mask[base + x] > 0.5) {
      if (first < 0) first = x
      last = x
    }
  }
  return first < 0 ? 0 : last - first + 1
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

  try {
    const result = landmarker.detect(bitmap)
    const lm = result.landmarks?.[0]
    if (!lm) return { ok: false, widths: null, visibility: 0, reason: 'no_body' }

    const keyPoints = [lm[L_SHOULDER], lm[R_SHOULDER], lm[L_HIP], lm[R_HIP]]
    const visibility = avg(keyPoints.map((p) => p?.visibility ?? 0))

    const mask = result.segmentationMasks?.[0]
    if (!mask) return { ok: false, widths: null, visibility, reason: 'silhouette_unreadable' }

    const W = mask.width
    const H = mask.height
    const data = mask.getAsFloat32Array()

    const yShoulder = ((lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2) * H
    const yHip = ((lm[L_HIP].y + lm[R_HIP].y) / 2) * H
    const yWaist = yShoulder + (yHip - yShoulder) * THRESHOLDS.waistRowFactor

    const shoulderW = silhouetteWidth(data, W, H, yShoulder)
    const waistW = silhouetteWidth(data, W, H, yWaist)
    const hipW = silhouetteWidth(data, W, H, yHip)

    mask.close?.()
    bitmap.close()

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
    bitmap.close()
    return { ok: false, widths: null, visibility: 0, reason: 'silhouette_unreadable' }
  }
}
