import { describe, expect, it } from 'vitest'
import {
  assessLivePose,
  assessDetectedPoses,
  createPoseFeedbackTracker,
} from './live-pose-guide'

function pose() {
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.95,
  }))
  points[0].y = 0.08
  points[11] = { x: 0.38, y: 0.25, visibility: 0.95 }
  points[12] = { x: 0.62, y: 0.25, visibility: 0.95 }
  points[23] = { x: 0.4, y: 0.53, visibility: 0.95 }
  points[24] = { x: 0.6, y: 0.53, visibility: 0.95 }
  points[15] = { x: 0.28, y: 0.62, visibility: 0.95 }
  points[16] = { x: 0.72, y: 0.62, visibility: 0.95 }
  points[25] = { x: 0.4, y: 0.73, visibility: 0.95 }
  points[26] = { x: 0.6, y: 0.73, visibility: 0.95 }
  points[27] = { x: 0.4, y: 0.92, visibility: 0.95 }
  points[28] = { x: 0.6, y: 0.92, visibility: 0.95 }
  return points
}
describe('optional body framing', () => {
  it('reports multiple people without drawing a misleading body overlay', () => {
    expect(assessDetectedPoses([pose(), pose()])).toEqual({
      status: 'multiple_bodies',
      points: [],
      alignment: 0,
    })
    expect(assessDetectedPoses([]).status).toBe('no_body')
  })
  it('allows natural framing without matching rigid lines', () => {
    const points = pose().map((point) => ({ ...point, x: point.x + 0.14 }))
    expect(assessLivePose(points).status).toBe('ready')
  })
  it('handles incomplete and nonfinite results without rendering invalid coordinates', () => {
    expect(assessLivePose([]).status).toBe('no_body')
    const points = pose()
    points[11].x = NaN
    expect(assessLivePose(points).points).toEqual([])
  })
  it('distinguishes cropped feet, poor light and off-center framing', () => {
    const cropped = pose()
    cropped[27].y = 1.1
    expect(assessLivePose(cropped).status).toBe('not_full_body')
    expect(
      assessLivePose(pose().map((point) => ({ ...point, visibility: NaN })))
        .status
    ).toBe('low_visibility')
    expect(
      assessLivePose(pose().map((point) => ({ ...point, x: point.x + 0.3 })))
        .status
    ).toBe('off_center')
  })
  it('warns about a seated pose while the person is still fully inside the frame', () => {
    const seated = pose()
    seated[25] = { x: 0.68, y: 0.55, visibility: 0.95 }
    seated[26] = { x: 0.8, y: 0.55, visibility: 0.95 }
    seated[27] = { x: 0.68, y: 0.8, visibility: 0.95 }
    seated[28] = { x: 0.8, y: 0.8, visibility: 0.95 }
    expect(assessDetectedPoses([seated], 0.75).status).toBe('not_standing')
  })
  it('does not give a ready cue when a torso landmark is unreliable', () => {
    const points = pose()
    points[11].visibility = 0.45
    expect(assessLivePose(points).status).toBe('low_visibility')
  })
})

describe('stable body feedback', () => {
  it('waits for sustained framing and drops the positive cue when the person moves', () => {
    const feedback = createPoseFeedbackTracker(),
      frame = assessLivePose(pose())
    expect(feedback(frame, 0).status).toBe('hold_still')
    expect(feedback(frame, 400).status).toBe('hold_still')
    expect(feedback(frame, 800).status).toBe('ready')
    const moved = assessLivePose(pose().map((p) => ({ ...p, x: p.x + 0.06 })))
    expect(feedback(moved, 1000).status).toBe('hold_still')
  })
  it('removes the overlay immediately when a body is lost or a second person appears', () => {
    const feedback = createPoseFeedbackTracker()
    feedback(assessLivePose(pose()), 0)
    expect(feedback(assessDetectedPoses([]), 200).points).toEqual([])
    expect(feedback(assessDetectedPoses([pose(), pose()]), 400).points).toEqual(
      []
    )
    expect(feedback(assessLivePose(pose()), 600).status).toBe('hold_still')
  })
  it('does not reuse a steady result after a long gap', () => {
    const feedback = createPoseFeedbackTracker(),
      frame = assessLivePose(pose())
    feedback(frame, 0)
    feedback(frame, 800)
    expect(feedback(frame, 3000).status).toBe('hold_still')
  })
})
