import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireStream, hasLiveVideo, cameraIssue, captureVideoFrame, requestVideoStream, startCaptureCountdown, waitForVideo } from './camera'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function stream() {
  const track = { stop: vi.fn(), readyState: 'live', label: 'Front camera', getSettings: () => ({ facingMode: 'user' }) }
  const value = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  return { track, value }
}

describe('camera lifecycle', () => {
  it('opens the user-selected physical lens instead of the default wide lens', async () => {
    const live = stream(); const getUserMedia = vi.fn().mockResolvedValue(live.value)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    expect((await requestVideoStream('user', new AbortController().signal, 'normal-lens')).stream).toBe(live.value)
    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: expect.objectContaining({ deviceId: { exact: 'normal-lens' }, frameRate: { ideal: 24, max: 30 } }) })
  })
  it('times out ignored permission requests and stops a stream that arrives too late', async () => {
    vi.useFakeTimers()
    const live = stream()
    let deliver!: (value: MediaStream) => void
    const getUserMedia = vi.fn().mockReturnValue(new Promise<MediaStream>(resolve => { deliver = resolve }))
    const result = acquireStream({ getUserMedia }, { video: true }, new AbortController().signal, 100)
    const failed = expect(result).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(100)
    await failed
    deliver(live.value)
    await vi.waitFor(() => expect(live.track.stop).toHaveBeenCalledOnce())
    expect(vi.getTimerCount()).toBe(0)
  })
  it('cancels a pending camera request and releases late video', async () => {
    const live = stream()
    const controller = new AbortController()
    let deliver!: (value: MediaStream) => void
    const result = acquireStream({ getUserMedia: vi.fn().mockReturnValue(new Promise<MediaStream>(resolve => { deliver = resolve })) }, { video: true }, controller.signal)
    const failed = expect(result).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    controller.abort()
    await failed
    deliver(live.value)
    await vi.waitFor(() => expect(live.track.stop).toHaveBeenCalledOnce())
  })
  it('does not repeat prompts after denied permission; falls back only for unsupported lens constraints', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    await expect(requestVideoStream('environment', new AbortController().signal)).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(getUserMedia).toHaveBeenCalledOnce()
    const live = stream()
    getUserMedia.mockReset().mockRejectedValueOnce(new DOMException('Missing lens', 'OverconstrainedError')).mockResolvedValueOnce(live.value)
    const result = await requestVideoStream('environment', new AbortController().signal)
    expect(result.facingMode).toBe('user')
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(getUserMedia.mock.calls.every(call => call[0].audio === false)).toBe(true)
  })
  it('bounds device enumeration while retaining the available lens', async () => {
    vi.useFakeTimers()
    const live = stream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(live.value), enumerateDevices: () => new Promise(() => {}) } })
    const pending = requestVideoStream('environment', new AbortController().signal)
    await vi.advanceTimersByTimeAsync(1000)
    expect((await pending).stream).toBe(live.value)
    expect(live.track.stop).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('releases the provisional lens immediately if enumeration is cancelled', async () => {
    const live = stream()
    const controller = new AbortController()
    const enumerateDevices = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(live.value), enumerateDevices } })
    const pending = requestVideoStream('environment', controller.signal)
    const failed = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(enumerateDevices).toHaveBeenCalled())
    controller.abort()
    await failed
    expect(live.track.stop).toHaveBeenCalled()
  })
  it('uses a labelled physical lens when a browser ignores facingMode', async () => {
    const front = stream(); const rear = stream()
    rear.track.getSettings = () => ({ facingMode: 'environment' })
    const getUserMedia = vi.fn().mockResolvedValueOnce(front.value).mockResolvedValueOnce(rear.value)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, enumerateDevices: async () => [{ kind: 'videoinput', label: 'Back camera', deviceId: 'rear' }] } })
    expect((await requestVideoStream('environment', new AbortController().signal)).stream).toBe(rear.value)
    expect(front.track.stop).toHaveBeenCalledOnce()
    expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ deviceId: { exact: 'rear' } }) }))
  })
  it('rejects ended or muted tracks even when decoded pixels remain', () => {
    const live = stream()
    expect(hasLiveVideo(live.value)).toBe(true)
    live.track.readyState = 'ended'
    expect(hasLiveVideo(live.value)).toBe(false)
    expect(hasLiveVideo({ getVideoTracks: () => [{ readyState: 'live', muted: true }] } as unknown as MediaStream)).toBe(false)
  })
  it('recognises a decoded frame even if loadeddata fired before attachment', async () => {
    const video = Object.assign(new EventTarget(), { readyState: 2, videoWidth: 640, videoHeight: 480, play: vi.fn().mockResolvedValue(undefined), srcObject: null })
    const live = stream()
    await waitForVideo(video as unknown as HTMLVideoElement, live.value, new AbortController().signal)
    expect(video.srcObject).toBe(live.value)
  })
  it('times out a stream with no decoded video and cleans its readiness timers', async () => {
    vi.useFakeTimers()
    const video = Object.assign(new EventTarget(), { readyState: 0, videoWidth: 0, videoHeight: 0, play: vi.fn().mockReturnValue(new Promise(() => {})), srcObject: null })
    const pending = waitForVideo(video as unknown as HTMLVideoElement, stream().value, new AbortController().signal, 100)
    const failed = expect(pending).rejects.toThrow('Video unavailable')
    await vi.advanceTimersByTimeAsync(100)
    await failed
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each([['NotAllowedError', 'permission'], ['NotFoundError', 'missing'], ['NotReadableError', 'busy'], ['TimeoutError', 'timeout']])('explains %s', (name, issue) => {
    expect(cameraIssue(new DOMException('Error', name))).toBe(issue)
  })
})

describe('capture countdown', () => {
  it('captures exactly once after ten seconds', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    const onTick = vi.fn(); const onCapture = vi.fn(); const onCancel = vi.fn()
    startCaptureCountdown({ onTick, onCapture, onCancel, canCapture: () => true })
    expect(onTick).toHaveBeenLastCalledWith(10)
    await vi.advanceTimersByTimeAsync(9900)
    expect(onCapture).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5100)
    expect(onCapture).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('cancels when hidden or video is no longer available, with no delayed capture', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    let available = true
    const onCapture = vi.fn(); const onCancel = vi.fn()
    startCaptureCountdown({ onTick: vi.fn(), onCapture, onCancel, canCapture: () => available })
    await vi.advanceTimersByTimeAsync(9000)
    available = false
    await vi.advanceTimersByTimeAsync(3000)
    expect(onCapture).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('user cancellation prevents capture and clears the timer', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    const onCapture = vi.fn()
    const cancel = startCaptureCountdown({ onTick: vi.fn(), onCapture, onCancel: vi.fn(), canCapture: () => true })
    cancel(); cancel()
    await vi.advanceTimersByTimeAsync(20000)
    expect(onCapture).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('photo encoding', () => {
  const video = { readyState: 2, videoWidth: 4000, videoHeight: 3000 } as HTMLVideoElement
  it('saves the full frame at a bounded resolution and releases canvas memory', async () => {
    const drawImage = vi.fn()
    const blob = new Blob(['synthetic'], { type: 'image/jpeg' })
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (callback: (blob: Blob) => void) => callback(blob) }
    vi.stubGlobal('document', { createElement: () => canvas })
    expect(await captureVideoFrame(video, new AbortController().signal)).toBe(blob)
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1440)
    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
  })
  it('rejects failed encoding and invalid frames rather than silently dropping the photo', async () => {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback: (blob: null) => void) => callback(null) }
    vi.stubGlobal('document', { createElement: () => canvas })
    await expect(captureVideoFrame(video, new AbortController().signal)).rejects.toThrow('Photo unavailable')
    await expect(captureVideoFrame({ ...video, videoWidth: 0 }, new AbortController().signal)).rejects.toThrow('No camera frame')
    expect(canvas.width).toBe(0)
  })
})
