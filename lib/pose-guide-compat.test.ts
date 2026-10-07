import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const model = vi.hoisted(() => ({ fileset: vi.fn(), create: vi.fn() }))
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: model.fileset },
  PoseLandmarker: { createFromOptions: model.create },
}))
import { createCompatibilityPoseGuide } from './pose-guide-compat'
const video = {
  readyState: 4,
  videoWidth: 1080,
  videoHeight: 1440,
} as HTMLVideoElement
let detector: {
  close: ReturnType<typeof vi.fn>
  detectForVideo: ReturnType<typeof vi.fn>
}
beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      width: 1,
      height: 1,
      getContext: vi.fn(() => null),
    })),
  })
  detector = {
    close: vi.fn(),
    detectForVideo: vi.fn(() => ({ landmarks: [] })),
  }
  model.fileset.mockReset().mockResolvedValue({})
  model.create.mockReset().mockResolvedValue(detector)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('Safari video detector', () => {
  it('uses an explicit DOM canvas and the video directly without bitmap APIs', async () => {
    const guide = createCompatibilityPoseGuide()
    await guide.ready
    expect(model.create.mock.calls[0][1]).toMatchObject({
      canvas: expect.any(Object),
      runningMode: 'VIDEO',
      numPoses: 2,
    })
    expect((await guide.detect(video, 100)).status).toBe('no_body')
    await guide.detect(video, 100)
    expect(detector.detectForVideo).toHaveBeenNthCalledWith(1, video, 100)
    expect(detector.detectForVideo).toHaveBeenNthCalledWith(2, video, 101)
    guide.dispose()
    guide.dispose()
    expect(detector.close).toHaveBeenCalledOnce()
  })
  it('falls back to CPU when GPU setup fails', async () => {
    model.create
      .mockRejectedValueOnce(new Error('GPU unavailable'))
      .mockResolvedValueOnce(detector)
    const guide = createCompatibilityPoseGuide()
    await guide.ready
    expect(
      model.create.mock.calls.map((call) => call[1].baseOptions.delegate)
    ).toEqual(['GPU', 'CPU'])
    guide.dispose()
  })
  it('closes a model that finishes loading after the camera is closed', async () => {
    let resolve!: (value: typeof detector) => void
    model.create.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        })
    )
    const guide = createCompatibilityPoseGuide()
    const failed = expect(guide.ready).rejects.toMatchObject({
      name: 'AbortError',
    })
    await vi.waitFor(() => expect(model.create).toHaveBeenCalledOnce())
    guide.dispose()
    resolve(detector)
    await failed
    await vi.waitFor(() => expect(detector.close).toHaveBeenCalledOnce())
  })
  it('bounds a stalled download and closes a late model', async () => {
    vi.useFakeTimers()
    let resolve!: (value: typeof detector) => void
    model.create.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        })
    )
    const guide = createCompatibilityPoseGuide()
    const failed = expect(guide.ready).rejects.toThrow('download timed out')
    await vi.advanceTimersByTimeAsync(40000)
    await failed
    resolve(detector)
    await Promise.resolve()
    expect(detector.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
