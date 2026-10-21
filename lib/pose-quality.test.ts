import { describe, it, expect } from 'vitest'
import { poseQualityIssue, type PosePoint } from './pose-quality'

function pose() {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }))
  p[11] = { x: 0.35, y: 0.25, z: 0, visibility: 0.95 }
  p[12] = { x: 0.65, y: 0.25, z: 0, visibility: 0.95 }
  p[23] = { x: 0.4, y: 0.55, z: 0, visibility: 0.95 }
  p[24] = { x: 0.6, y: 0.55, z: 0, visibility: 0.95 }
  p[25] = { x: 0.39, y: 0.74, z: 0, visibility: 0.95 }
  p[26] = { x: 0.61, y: 0.74, z: 0, visibility: 0.95 }
  p[27] = { x: 0.38, y: 0.94, z: 0, visibility: 0.95 }
  p[28] = { x: 0.62, y: 0.94, z: 0, visibility: 0.95 }
  p[15].x = 0.25
  p[16].x = 0.75
  return p
}

function seatedPose() {
  const p = pose()
  p[25] = { ...p[25], x: 0.26, y: 0.57 }
  p[26] = { ...p[26], x: 0.74, y: 0.57 }
  p[27] = { ...p[27], x: 0.29, y: 0.81 }
  p[28] = { ...p[28], x: 0.71, y: 0.81 }
  return p
}

const scaled = (p: PosePoint[], scale: number) => p.map((point) => ({
  ...point, x: 0.5 + (point.x - 0.5) * scale,
  y: 0.5 + (point.y - 0.5) * scale, z: (point.z ?? 0) * scale,
}))
const inAspect = (p: PosePoint[], aspect: number) => p.map((point) => ({
  ...point, x: 0.5 + (point.x - 0.5) / aspect, z: (point.z ?? 0) / aspect,
}))

describe('conservative posture checks', () => {
  it('accepts a relaxed front view and a small natural lean', () => {
    expect(poseQualityIssue(pose())).toBeNull()
    const p = pose()
    p[11].y -= 0.015
    p[12].y += 0.015
    p[11].x -= 0.025
    p[12].x -= 0.025
    expect(poseQualityIssue(p)).toBeNull()
  })

  it('does not change posture decisions when the person is farther from the camera', () => {
    for (const scale of [0.3, 0.6, 1]) {
      expect(poseQualityIssue(scaled(pose(), scale))).toBeNull()
      expect(poseQualityIssue(scaled(seatedPose(), scale))).toBe('not_standing')
    }
  })

  it('uses actual image aspect for equivalent portrait and landscape geometry', () => {
    for (const aspect of [0.75, 1, 16 / 9]) {
      expect(poseQualityIssue(inAspect(pose(), aspect), aspect)).toBeNull()
      expect(poseQualityIssue(inAspect(seatedPose(), aspect), aspect)).toBe('not_standing')
    }
  })

  it('detects sitting with both folded legs instead of relying on torso tilt', () => {
    expect(poseQualityIssue(seatedPose())).toBe('not_standing')
    const p = seatedPose()
    p[25].y = p[26].y = 0.48
    p[27].y = p[28].y = 0.72
    expect(poseQualityIssue(p)).toBe('not_standing')
  })

  it('prioritizes standing guidance when a seated person also turns sideways', () => {
    const p = seatedPose()
    p[12].z = p[24].z = 0.5
    expect(poseQualityIssue(p)).toBe('not_standing')
  })

  it('does not call a single bent leg or an occluded knee seated', () => {
    const p = seatedPose(), standing = pose()
    for (const i of [24, 26, 28]) p[i] = standing[i]
    expect(poseQualityIssue(p)).toBeNull()
    const occluded = seatedPose()
    occluded[25].visibility = 0.2
    expect(poseQualityIssue(occluded)).toBeNull()
  })

  it('detects strong turns supported by both shoulder and hip depth', () => {
    const p = pose()
    p[12].z = 0.5
    p[24].z = 0.5
    expect(poseQualityIssue(p)).toBe('not_front_facing')
  })

  it('does not call a one-shoulder twist a side view or invent missing depth', () => {
    const p = pose()
    p[12].z = 0.5
    expect(poseQualityIssue(p)).toBeNull()
    expect(poseQualityIssue(pose().map(({ z, ...point }) => point))).toBeNull()
  })

  it('requires every torso landmark rather than hiding one bad point in an average', () => {
    const p = pose()
    p[11].visibility = 0.5
    expect(poseQualityIssue(p)).toBe('low_visibility')
    p[11].visibility = 0.95
    p[23].x = NaN
    expect(poseQualityIssue(p)).toBe('low_visibility')
    expect(poseQualityIssue([])).toBe('low_visibility')
  })

  it('rejects a marked torso lean while accepting harmless camera-distance changes', () => {
    const p = pose()
    p[11].x -= 0.22
    p[12].x -= 0.22
    expect(poseQualityIssue(p)).toBe('posture')
    expect(poseQualityIssue(scaled(p, 0.5))).toBe('posture')
  })

  it('identifies crossed arms but ignores an occluded wrist', () => {
    const p = pose()
    p[15].x = 0.5
    expect(poseQualityIssue(p)).toBe('arms_obscured')
    p[15].visibility = 0.2
    expect(poseQualityIssue(p)).toBeNull()
  })
})
