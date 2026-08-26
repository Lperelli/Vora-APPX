import { asset } from '@/lib/base-path'
import { POSE_MODEL_PATH, POSE_WASM_BASE } from '@/lib/photo-flow'

export type LivePoseStatus =
  | 'loading'
  | 'no_body'
  | 'low_visibility'
  | 'not_full_body'
  | 'too_close'
  | 'too_far'
  | 'off_center'
  | 'posture'
  | 'ready'
  | 'unavailable'

export interface LivePosePoint {
  x: number
  y: number
  visibility: number
}

export interface LivePoseFrame {
  status: LivePoseStatus
  points: LivePosePoint[]
  alignment: number
}

type PoseLandmarkerVideo = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> }
}

const NO_FRAME: LivePoseFrame = { status: 'no_body', points: [], alignment: 0 }
let videoLandmarkerPromise: Promise<PoseLandmarkerVideo> | null = null

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
}

function visibility(point: { visibility?: number } | undefined) {
  return point?.visibility ?? 0
}

async function getVideoLandmarker(): Promise<PoseLandmarkerVideo> {
  if (!videoLandmarkerPromise) {
    videoLandmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(asset(POSE_WASM_BASE))
      const options = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: asset(POSE_MODEL_PATH), delegate },
        runningMode: 'VIDEO' as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputSegmentationMasks: false,
      })
      try {
        return (await PoseLandmarker.createFromOptions(fileset, options('GPU'))) as PoseLandmarkerVideo
      } catch {
        return (await PoseLandmarker.createFromOptions(fileset, options('CPU'))) as PoseLandmarkerVideo
      }
    })()
  }
  return videoLandmarkerPromise
}

export function preloadLivePoseGuide() {
  return getVideoLandmarker().then(() => undefined)
}

/**
 * Gives a Face-ID-like framing signal without identifying the person. All
 * inference happens locally and only normalized pose points leave MediaPipe.
 */
export async function detectLivePose(video: HTMLVideoElement, timestampMs: number): Promise<LivePoseFrame> {
  let result: ReturnType<PoseLandmarkerVideo['detectForVideo']>
  try {
    result = (await getVideoLandmarker()).detectForVideo(video, timestampMs)
  } catch {
    return { status: 'unavailable', points: [], alignment: 0 }
  }

  const landmarks = result.landmarks?.[0]
  if (!landmarks) return NO_FRAME

  const points = landmarks.map((point) => ({
    x: point.x,
    y: point.y,
    visibility: visibility(point),
  }))

  const nose = points[0]
  const shoulders = [points[11], points[12]]
  const hips = [points[23], points[24]]
  const knees = [points[25], points[26]]
  const ankles = [points[27], points[28]]
  const keyPoints = [nose, ...shoulders, ...hips, ...knees, ...ankles]
  const meanVisibility = average(keyPoints.map((point) => point?.visibility ?? 0))

  if (meanVisibility < 0.5) return { status: 'low_visibility', points, alignment: 0.2 }
  if (ankles.some((point) => !point || point.visibility < 0.38) || nose.visibility < 0.5) {
    return { status: 'not_full_body', points, alignment: 0.35 }
  }

  const topY = nose.y
  const bottomY = Math.max(ankles[0].y, ankles[1].y)
  const bodyHeight = bottomY - topY
  const shoulderWidth = Math.abs(shoulders[0].x - shoulders[1].x)
  const centerX = average([...shoulders, ...hips].map((point) => point.x))
  const centerOffset = Math.abs(centerX - 0.5)
  const shoulderTilt = Math.abs(shoulders[0].y - shoulders[1].y)
  const hipTilt = Math.abs(hips[0].y - hips[1].y)

  if (topY < 0.025 || bottomY > 0.985) return { status: 'not_full_body', points, alignment: 0.45 }
  if (bodyHeight > 0.91 || shoulderWidth > 0.56) return { status: 'too_close', points, alignment: 0.55 }
  if (bodyHeight < 0.56) return { status: 'too_far', points, alignment: 0.55 }
  if (centerOffset > 0.11) return { status: 'off_center', points, alignment: 0.7 }
  if (shoulderTilt > 0.055 || hipTilt > 0.06) return { status: 'posture', points, alignment: 0.78 }

  const alignment = Math.max(0, Math.min(1, 1 - centerOffset * 2.6 - shoulderTilt - hipTilt))
  return { status: 'ready', points, alignment }
}
