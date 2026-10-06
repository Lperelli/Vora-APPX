export type CameraFacingMode = 'user' | 'environment'
export type CameraIssue = 'permission' | 'missing' | 'busy' | 'timeout' | 'preview' | 'inactive' | 'capture' | 'unsupported'

export const CAMERA_MESSAGES: Record<CameraIssue, string> = {
  permission: 'Camera access is blocked. Allow camera access in your browser settings, then try again.',
  missing: 'No camera was found. Connect a camera or choose a photo from your library.',
  busy: 'The camera is unavailable or in use by another app. Close that app, then try again.',
  timeout: 'The camera did not respond. Check browser camera access, then try again or use your photo library.',
  preview: 'The camera opened but no live video arrived. Try again or use your photo library.',
  inactive: 'The camera was paused when you left this page. Restart it when you are ready.',
  capture: 'We couldn’t save this photo. Please try again or choose one from your library.',
  unsupported: 'Live camera is unavailable in this browser. Use your photo library or enter your measurements.',
}

export function cameraIssue(error: unknown): CameraIssue {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing'
  if (name === 'TimeoutError') return 'timeout'
  return 'busy'
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop())
}

function inferredFacing(stream: MediaStream, fallback: CameraFacingMode): CameraFacingMode {
  const track = stream.getVideoTracks()[0]
  const settings = track?.getSettings()
  if (settings?.facingMode === 'user' || settings?.facingMode === 'environment') return settings.facingMode
  const label = track?.label.toLowerCase() || ''
  if (/back|rear|environment|trasera/.test(label)) return 'environment'
  if (/front|user|facetime|frontal/.test(label)) return 'user'
  return fallback
}

/** getUserMedia cannot be cancelled; stop streams that arrive after cancellation/timeout. */
export function acquireStream(
  media: Pick<MediaDevices, 'getUserMedia'>,
  constraints: MediaStreamConstraints,
  signal: AbortSignal,
  timeoutMs = 20000,
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return }
    let settled = false
    const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel) }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      clean()
      reject(error)
    }
    const cancel = () => fail(new DOMException('Cancelled', 'AbortError'))
    const timer = setTimeout(() => fail(new DOMException('Camera timeout', 'TimeoutError')), timeoutMs)
    signal.addEventListener('abort', cancel, { once: true })
    Promise.resolve().then(() => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      return media.getUserMedia(constraints)
    }).then(stream => {
      if (settled || signal.aborted) { stopMediaStream(stream); return }
      if (!stream.getVideoTracks().some(track => track.readyState === 'live')) {
        stopMediaStream(stream)
        fail(new DOMException('No live camera', 'NotFoundError'))
        return
      }
      settled = true
      clean()
      resolve(stream)
    }, fail)
  })
}

/** Device lookup must not keep an unowned camera running indefinitely. */
function cameraDevices(media: MediaDevices, stream: MediaStream, signal: AbortSignal): Promise<MediaDeviceInfo[]> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (devices: MediaDeviceInfo[], aborted = false) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      if (aborted) {
        stopMediaStream(stream)
        reject(new DOMException('Cancelled', 'AbortError'))
      } else resolve(devices)
    }
    const cancel = () => finish([], true)
    const timer = setTimeout(() => finish([]), 1000)
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) { cancel(); return }
    Promise.resolve().then(() => media.enumerateDevices()).then(devices => finish(devices), () => finish([]))
  })
}

export function hasLiveVideo(stream: MediaStream | null) {
  return !!stream?.getVideoTracks().some(track => track.readyState === 'live' && !track.muted)
}

export async function requestVideoStream(facing: CameraFacingMode, signal: AbortSignal, deviceId?: string) {
  const media = navigator.mediaDevices
  const size = { width: { ideal: 1080 }, height: { ideal: 1440 }, frameRate: { ideal: 24, max: 30 } }
  if (deviceId) {
    const stream = await acquireStream(media, { video: { ...size, deviceId: { exact: deviceId } }, audio: false }, signal)
    return { stream, facingMode: inferredFacing(stream, facing) }
  }
  const choices: MediaTrackConstraints[] = [
    { ...size, facingMode: { exact: facing } },
    { ...size, facingMode: { ideal: facing } },
    {},
  ]
  for (let index = 0; index < choices.length; index++) {
    try {
      const stream = await acquireStream(media, { video: choices[index], audio: false }, signal)
      const actualFacing = inferredFacing(stream, facing)
      // Some mobile browsers ignore facingMode. After permission, labelled devices can identify the other lens.
      if (actualFacing !== facing && typeof media.enumerateDevices === 'function') {
        try {
          const devices = await cameraDevices(media, stream, signal)
          if (signal.aborted) { stopMediaStream(stream); throw new DOMException('Cancelled', 'AbortError') }
          const matcher = facing === 'environment' ? /back|rear|environment|trasera/i : /front|user|facetime|frontal/i
          const device = devices.find(device => device.kind === 'videoinput' && matcher.test(device.label) && device.deviceId !== stream.getVideoTracks()[0]?.getSettings().deviceId)
          if (device) {
            stopMediaStream(stream)
            const selected = await acquireStream(media, { video: { ...size, deviceId: { exact: device.deviceId } }, audio: false }, signal)
            return { stream: selected, facingMode: inferredFacing(selected, facing) }
          }
        } catch (error) {
          if (signal.aborted || stream.getVideoTracks().every(track => track.readyState === 'ended')) {
            stopMediaStream(stream)
            throw error
          }
          // Enumeration may be unavailable; retain the usable camera with its actual label.
        }
      }
      return { stream, facingMode: actualFacing }
    } catch (error) {
      const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ''
      // A denied permission, busy camera or ignored prompt must not trigger more prompts.
      if (!['OverconstrainedError', 'NotFoundError'].includes(name) || index === choices.length - 1) throw error
    }
  }
  throw new Error('Camera unavailable')
}

/** Readiness is actual decoded video, independent of model loading. */
export function waitForVideo(video: HTMLVideoElement, stream: MediaStream, signal: AbortSignal, timeoutMs = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return }
    let settled = false
    const clean = () => {
      clearTimeout(timer)
      clearInterval(poll)
      signal.removeEventListener('abort', cancel)
      video.removeEventListener('loadeddata', check)
      video.removeEventListener('playing', check)
      video.removeEventListener('error', failed)
    }
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clean()
      if (error) reject(error); else resolve()
    }
    const check = () => {
      if (hasLiveVideo(stream) && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) finish()
    }
    const failed = () => finish(new Error('Video unavailable'))
    const cancel = () => finish(new DOMException('Cancelled', 'AbortError'))
    const timer = setTimeout(failed, timeoutMs)
    const poll = setInterval(check, 100)
    video.addEventListener('loadeddata', check)
    video.addEventListener('playing', check)
    video.addEventListener('error', failed)
    signal.addEventListener('abort', cancel, { once: true })
    video.srcObject = stream
    void video.play().then(check, failed)
    check()
  })
}

/** Save the complete visible camera frame, without the mirrored preview or guide. */
export async function captureVideoFrame(video: HTMLVideoElement, signal: AbortSignal): Promise<Blob> {
  if (signal.aborted || video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('No camera frame')
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight))
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      let settled = false
      const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel) }
      const finish = (blob: Blob | null) => {
        if (settled) return
        settled = true
        clean()
        if (blob && !signal.aborted) resolve(blob); else reject(new Error('Photo unavailable'))
      }
      const cancel = () => finish(null)
      const timer = setTimeout(cancel, 8000)
      signal.addEventListener('abort', cancel, { once: true })
      try { canvas.toBlob(finish, 'image/jpeg', 0.92) } catch { finish(null) }
    })
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/** Monotonic countdown. Cancellation and current readiness win over timer completion. */
export function startCaptureCountdown(options: { onTick: (seconds: number) => void; onCapture: () => void; canCapture: () => boolean; onCancel: () => void }) {
  const deadline = performance.now() + 10000
  let active = true
  const cancel = () => { if (!active) return; active = false; clearInterval(timer); options.onCancel() }
  const tick = () => {
    if (!active) return
    if (!options.canCapture()) { cancel(); return }
    const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
    options.onTick(remaining)
    if (remaining === 0) { active = false; clearInterval(timer); options.onCapture() }
  }
  const timer = setInterval(tick, 100)
  tick()
  return cancel
}
