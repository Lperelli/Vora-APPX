import { describe, it, expect } from 'vitest'
import { poseQualityIssue } from './pose-quality'
function pose() {
  const p = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }))
  p[11] = { x: 0.35, y: 0.25, z: 0, visibility: 0.95 }
  p[12] = { x: 0.65, y: 0.25, z: 0, visibility: 0.95 }
  p[23] = { x: 0.4, y: 0.55, z: 0, visibility: 0.95 }
  p[24] = { x: 0.6, y: 0.55, z: 0, visibility: 0.95 }
  p[15].x = 0.25
  p[16].x = 0.75
  return p
}
describe('conservative posture checks', () => {
  it('accepts a relaxed front view', () =>
    expect(poseQualityIssue(pose())).toBeNull())
  it('detects strong turns supported by both shoulder and hip depth', () => {
    const p = pose()
    p[12].z = 0.5
    p[24].z = 0.5
    expect(poseQualityIssue(p)).toBe('not_front_facing')
  })
  it('does not call a one-shoulder twist a side view', () => {
    const p = pose()
    p[12].z = 0.5
    expect(poseQualityIssue(p)).toBeNull()
  })
  it('does not invent depth when unavailable', () => {
    const p = pose().map(({ z, ...point }) => point)
    expect(poseQualityIssue(p)).toBeNull()
  })
  it('identifies crossed arms, but not hands beside the body', () => {
    const p = pose()
    p[15].x = 0.5
    expect(poseQualityIssue(p)).toBe('arms_obscured')
  })
  it('ignores an occluded wrist instead of accusing an arm position', () => {
    const p = pose()
    p[15].x = 0.5
    p[15].visibility = 0.2
    expect(poseQualityIssue(p)).toBeNull()
  })
})
