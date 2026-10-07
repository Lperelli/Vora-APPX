import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const factories = vi.hoisted(() => ({
  worker: vi.fn(),
  compatibility: vi.fn(),
}))
vi.mock('./pose-guide-worker-client', () => ({
  createWorkerPoseGuide: factories.worker,
}))
vi.mock('./pose-guide-compat', () => ({
  createCompatibilityPoseGuide: factories.compatibility,
}))
import { createPoseGuide, useCompatiblePoseGuide } from './pose-guide-client'

const video = {} as HTMLVideoElement
const frame = { status: 'no_body', points: [], alignment: 0 }
const engine = () => ({
  ready: Promise.resolve(),
  dispose: vi.fn(),
  detect: vi.fn().mockResolvedValue(frame),
})
beforeEach(() => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
  })
  vi.stubGlobal('Worker', vi.fn())
  vi.stubGlobal('createImageBitmap', vi.fn())
  factories.worker.mockReset().mockImplementation(engine)
  factories.compatibility.mockReset().mockImplementation(engine)
})
afterEach(() => vi.unstubAllGlobals())

describe('body guide browser recovery', () => {
  it.each([
    [
      'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      true,
    ],
    [
      'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/16.4 Safari/605.1.15',
      true,
    ],
    [
      'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1',
      true,
    ],
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0 Safari/537.36', false],
    ['Mozilla/5.0 Gecko/20100101 Firefox/140.0', false],
  ])('selects the compatible path for %s', (ua, expected) =>
    expect(useCompatiblePoseGuide(ua)).toBe(expected)
  )

  it('starts directly with the video canvas on iPhone Safari', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'AppleWebKit/605.1 Version/18.0 Safari/604.1',
    })
    const guide = createPoseGuide()
    await guide.ready
    expect(factories.worker).not.toHaveBeenCalled()
    expect(guide.mode).toBe('compatibility')
    expect(await guide.detect(video, 10)).toEqual(frame)
    guide.dispose()
  })
  it('recovers from a worker initialization failure automatically', async () => {
    const worker = engine()
    worker.ready = Promise.reject(new Error('Worker canvas unavailable'))
    factories.worker.mockReturnValue(worker)
    const states: string[] = []
    const guide = createPoseGuide({
      onStateChange: (state) => states.push(state),
    })
    await guide.ready
    expect(worker.dispose).toHaveBeenCalledOnce()
    expect(await guide.detect(video, 1)).toEqual(frame)
    expect(states).toEqual(['loading', 'recovering', 'ready'])
    guide.dispose()
  })
  it('recovers if the worker cannot transfer or process the camera frame', async () => {
    const worker = engine()
    worker.detect.mockRejectedValue(new Error('Cannot transfer bitmap'))
    factories.worker.mockReturnValue(worker)
    const guide = createPoseGuide()
    await guide.ready
    expect(await guide.detect(video, 1)).toEqual(frame)
    expect(guide.mode).toBe('compatibility')
    expect(worker.dispose).toHaveBeenCalledOnce()
    guide.dispose()
  })
  it('retries a lost compatibility context once using CPU, then stops on failure', async () => {
    const first = engine(),
      second = engine()
    first.detect.mockRejectedValue(new Error('Context lost'))
    second.detect.mockRejectedValue(new Error('Unsupported'))
    factories.compatibility
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const guide = createPoseGuide({ strategy: 'compatibility' })
    await guide.ready
    await expect(guide.detect(video, 1)).rejects.toThrow('Unsupported')
    expect(factories.compatibility).toHaveBeenCalledTimes(2)
    expect(factories.compatibility).toHaveBeenLastCalledWith({
      preferCPU: true,
    })
    expect(first.dispose).toHaveBeenCalledOnce()
    guide.dispose()
    expect(second.dispose).toHaveBeenCalledOnce()
  })
  it('does not initialize another detector after closing during worker startup', async () => {
    const worker = engine()
    let reject!: (error: Error) => void
    worker.ready = new Promise((_, r) => {
      reject = r
    })
    worker.dispose.mockImplementation(() =>
      reject(new DOMException('Closed', 'AbortError'))
    )
    factories.worker.mockReturnValue(worker)
    const guide = createPoseGuide()
    const failed = expect(guide.ready).rejects.toMatchObject({
      name: 'AbortError',
    })
    guide.dispose()
    await failed
    expect(factories.compatibility).not.toHaveBeenCalled()
  })
  it('allows only one frame through during recovery', async () => {
    const worker = engine()
    let finish!: (value: typeof frame) => void
    worker.detect.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    factories.worker.mockReturnValue(worker)
    const guide = createPoseGuide()
    await guide.ready
    const first = guide.detect(video, 1)
    await expect(guide.detect(video, 2)).rejects.toThrow(
      'Frame already pending'
    )
    finish(frame)
    await first
    guide.dispose()
  })
})
