export type LivePoseStatus =
  | 'loading'
  | 'no_body'
  | 'multiple_bodies'
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

const NO_FRAME: LivePoseFrame = { status: 'no_body', points: [], alignment: 0 }

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
}

function visibility(point: { visibility?: number } | undefined) {
  const value = point?.visibility
  return value !== undefined && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

export function assessDetectedPoses(poses: Array<Array<{ x: number; y: number; visibility?: number }>>): LivePoseFrame {
  if (poses.length > 1) return { status: 'multiple_bodies', points: [], alignment: 0 }
  return assessLivePose(poses[0] || [])
}

/** Framing hints only; they never decide whether the shutter is available. */
export function assessLivePose(landmarks: Array<{ x: number; y: number; visibility?: number }>): LivePoseFrame {
  if (landmarks.length < 29 || landmarks.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) return NO_FRAME

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
  if (bodyHeight < 0.45) return { status: 'too_far', points, alignment: 0.55 }
  if (centerOffset > 0.18) return { status: 'off_center', points, alignment: 0.7 }
  if (shoulderTilt > 0.055 || hipTilt > 0.06) return { status: 'posture', points, alignment: 0.78 }

  const alignment = Math.max(0, Math.min(1, 1 - centerOffset * 2.6 - shoulderTilt - hipTilt))
  return { status: 'ready', points, alignment }
}
