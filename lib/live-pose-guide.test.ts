import { describe, expect, it } from 'vitest'
import { assessLivePose } from './live-pose-guide'

function pose() {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }))
  points[0].y = 0.08
  points[11] = { x: 0.38, y: 0.25, visibility: 0.95 }
  points[12] = { x: 0.62, y: 0.25, visibility: 0.95 }
  points[23] = { x: 0.4, y: 0.53, visibility: 0.95 }
  points[24] = { x: 0.6, y: 0.53, visibility: 0.95 }
  points[27].y = points[28].y = 0.92
  return points
}
describe('optional body framing', () => {
  it('allows natural framing without matching rigid lines', () => {
    const points = pose().map(point => ({ ...point, x: point.x + 0.14 }))
    expect(assessLivePose(points).status).toBe('ready')
  })
  it('handles incomplete and nonfinite results without rendering invalid coordinates', () => {
    expect(assessLivePose([]).status).toBe('no_body')
    const points = pose(); points[11].x = NaN
    expect(assessLivePose(points).points).toEqual([])
  })
  it('distinguishes cropped feet, poor light and off-center framing', () => {
    const cropped = pose(); cropped[27].y = 1.1
    expect(assessLivePose(cropped).status).toBe('not_full_body')
    expect(assessLivePose(pose().map(point => ({ ...point, visibility: NaN }))).status).toBe('low_visibility')
    expect(assessLivePose(pose().map(point => ({ ...point, x: point.x + 0.3 }))).status).toBe('off_center')
  })
})
