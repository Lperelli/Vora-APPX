import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkerPoseGuide as createPoseGuide } from './pose-guide-worker-client'

class TestWorker {
  static last: TestWorker
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { TestWorker.last = this }
  reply(data: unknown) { this.onmessage?.({ data }) }
}
const video = { videoWidth: 720, videoHeight: 1280 } as HTMLVideoElement
beforeEach(() => {
  vi.stubGlobal('window', { location: { href: 'http://localhost:3091/' } })
  vi.stubGlobal('Worker', TestWorker)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('local body-guide worker', () => {
  it('transfers a bounded frame and returns genuine worker detections', async () => {
    const bitmap = { close: vi.fn() }; const makeBitmap = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', makeBitmap)
    const guide = createPoseGuide(); const worker = TestWorker.last
    worker.reply({ type: 'ready' }); await guide.ready
    const frame = guide.detect(video, 123)
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(2))
    expect(makeBitmap).toHaveBeenCalledWith(video, { resizeWidth: 360, resizeHeight: 640 })
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'frame', id: 1, bitmap, timestamp: 123 }, [bitmap])
    worker.reply({ type: 'frame', id: 1, landmarks: [] })
    expect((await frame).status).toBe('no_body')
    expect(bitmap.close).not.toHaveBeenCalled() // ownership transferred to worker
    guide.dispose(); expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('does not queue another frame while a detection is pending', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const guide = createPoseGuide(); const worker = TestWorker.last
    worker.reply({ type: 'ready' }); await guide.ready
    const first = guide.detect(video, 100)
    await expect(guide.detect(video, 200)).rejects.toThrow('Frame already pending')
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(2))
    worker.reply({ type: 'frame', id: 1, landmarks: [] }); await first
    guide.dispose()
  })
  it('closes a bitmap that arrives after the modal was closed', async () => {
    let deliver!: (bitmap: ImageBitmap) => void
    vi.stubGlobal('createImageBitmap', vi.fn().mockReturnValue(new Promise(resolve => { deliver = resolve })))
    const guide = createPoseGuide(); const worker = TestWorker.last
    worker.reply({ type: 'ready' }); await guide.ready
    const frame = guide.detect(video, 123); const failed = expect(frame).rejects.toMatchObject({ name: 'AbortError' })
    guide.dispose()
    const bitmap = { close: vi.fn() }; deliver(bitmap as unknown as ImageBitmap)
    await failed
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledOnce()
  })
  it('bounds a stalled model download and terminates its worker', async () => {
    vi.useFakeTimers()
    const guide = createPoseGuide(); const worker = TestWorker.last
    const failed = expect(guide.ready).rejects.toThrow('Body guide timed out')
    await vi.advanceTimersByTimeAsync(20000); await failed
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('terminates a stalled inference and rejects the frame', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const guide = createPoseGuide(); const worker = TestWorker.last
    worker.reply({ type: 'ready' }); await guide.ready
    const frame = guide.detect(video, 123); const failed = expect(frame).rejects.toThrow('Frame timed out')
    await vi.advanceTimersByTimeAsync(4000); await failed
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('releases the copied frame when posting to the worker fails', async () => {
    const bitmap = { close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const guide = createPoseGuide(); const worker = TestWorker.last
    worker.reply({ type: 'ready' }); await guide.ready
    worker.postMessage.mockImplementation(() => { throw new Error('Cannot transfer') })
    await expect(guide.detect(video, 123)).rejects.toThrow('Body guide unavailable')
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
