import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkerPoseGuide } from './pose-guide-worker-client'

class TestWorker {
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  onmessage: ((event: { data: Record<string, unknown> }) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { workers.push(this) }
  message(data: Record<string, unknown>) { this.onmessage?.({ data }) }
}
let workers: TestWorker[] = []
const makeBitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap
const video = { readyState: 4, videoWidth: 1080, videoHeight: 1440 } as HTMLVideoElement
let prepare: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  workers = []
  prepare = vi.fn()
  vi.stubGlobal('Worker', TestWorker)
  vi.stubGlobal('window', { location: { href: 'https://vora.example/app' } })
  vi.stubGlobal('createImageBitmap', prepare)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:guide')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
async function start() {
  const guide = createWorkerPoseGuide()
  const worker = workers[0]
  worker.message({ type: 'ready' })
  await guide.ready
  return { guide, worker }
}

describe('camera worker frame lifecycle', () => {
  it('times out stalled bitmap preparation and closes a bitmap that arrives late', async () => {
    let finish!: (bitmap: ImageBitmap) => void
    prepare.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { guide, worker } = await start()
    const rejected = expect(guide.detect(video, 100)).rejects.toThrow('Frame timed out')
    await vi.advanceTimersByTimeAsync(4000)
    await rejected
    expect(worker.terminate).toHaveBeenCalledOnce()
    const bitmap = makeBitmap()
    finish(bitmap)
    await Promise.resolve()
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledOnce() // Only initialization.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels an in-progress bitmap immediately when the camera is closed', async () => {
    let finish!: (bitmap: ImageBitmap) => void
    prepare.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { guide, worker } = await start()
    const rejected = expect(guide.detect(video, 100)).rejects.toMatchObject({ name: 'AbortError' })
    guide.dispose()
    await rejected
    const bitmap = makeBitmap()
    finish(bitmap)
    await Promise.resolve()
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds the resize-unsupported fallback with the same frame deadline', async () => {
    let finish!: (bitmap: ImageBitmap) => void
    prepare.mockRejectedValueOnce(new TypeError('Resize unsupported'))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const { guide, worker } = await start()
    const rejected = expect(guide.detect(video, 100)).rejects.toThrow('Frame timed out')
    await vi.advanceTimersByTimeAsync(4000)
    await rejected
    expect(prepare).toHaveBeenLastCalledWith(video)
    const bitmap = makeBitmap()
    finish(bitmap)
    await Promise.resolve()
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('includes bitmap preparation time in the worker response deadline', async () => {
    let finish!: (bitmap: ImageBitmap) => void
    prepare.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { guide, worker } = await start()
    const rejected = expect(guide.detect(video, 100)).rejects.toThrow('Frame timed out')
    await vi.advanceTimersByTimeAsync(3000)
    finish(makeBitmap())
    await Promise.resolve()
    expect(worker.postMessage).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    await rejected
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('transfers one proportional frame, prevents overlap and clears the deadline after a response', async () => {
    const bitmap = makeBitmap()
    prepare.mockResolvedValue(bitmap)
    const { guide, worker } = await start()
    const frame = guide.detect(video, 100)
    await expect(guide.detect(video, 101)).rejects.toThrow('Frame already pending')
    expect(prepare).toHaveBeenCalledWith(video, { resizeWidth: 480, resizeHeight: 640 })
    expect(worker.postMessage).toHaveBeenLastCalledWith(
      { type: 'frame', id: 1, bitmap, timestamp: 100 }, [bitmap]
    )
    worker.message({ type: 'frame', id: 1, landmarks: [] })
    expect((await frame).status).toBe('no_body')
    expect(bitmap.close).not.toHaveBeenCalled() // Ownership was transferred.
    expect(vi.getTimerCount()).toBe(0)
    guide.dispose()
  })

  it('closes an untransferred bitmap if posting to the worker fails', async () => {
    const bitmap = makeBitmap()
    prepare.mockResolvedValue(bitmap)
    const { guide, worker } = await start()
    worker.postMessage.mockImplementationOnce(() => { throw new Error('Transfer failed') })
    await expect(guide.detect(video, 100)).rejects.toThrow('Body guide unavailable')
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
