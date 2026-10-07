import { asset } from './base-path'
import { POSE_MODEL_PATH, VISION_ASSET_PATH } from './vision-assets'
import { assessDetectedPoses, type LivePoseFrame } from './live-pose-guide'

/** A disposable worker owns the model and every transferred camera bitmap. */
export function createWorkerPoseGuide() {
  const script = new URL(
    asset('/pose-guide.worker.js?v=3'),
    window.location.href
  ).href
  // Webflow serves assets on a separate origin. A same-origin blob bootstrap
  // can import that public classic worker without a cross-origin Worker error.
  const bootstrap = URL.createObjectURL(
    new Blob([`importScripts(${JSON.stringify(script)})`], {
      type: 'text/javascript',
    })
  )
  let worker: Worker
  try {
    worker = new Worker(bootstrap)
  } catch (error) {
    URL.revokeObjectURL(bootstrap)
    throw error
  }
  let closed = false
  let initialised = false
  let creatingFrame = false
  let nextId = 0
  let pending: {
    id: number
    resolve: (frame: LivePoseFrame) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null
  let resolveReady!: () => void
  let rejectReady!: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  const initialisationTimer = setTimeout(
    () => fail(new Error('Body guide timed out')),
    20000
  )

  function dispose() {
    if (closed) return
    closed = true
    clearTimeout(initialisationTimer)
    URL.revokeObjectURL(bootstrap)
    worker.terminate()
    const error = new DOMException('Body guide closed', 'AbortError')
    rejectReady(error)
    if (pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
      pending = null
    }
  }
  function fail(error: Error) {
    rejectReady(error)
    if (pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
      pending = null
    }
    dispose()
  }
  worker.onerror = () => fail(new Error('Body guide unavailable'))
  worker.onmessageerror = () => fail(new Error('Body guide unavailable'))
  worker.onmessage = ({ data }) => {
    if (closed) return
    if (data?.type === 'error') {
      fail(new Error('Body guide unavailable'))
      return
    }
    if (data?.type === 'ready') {
      initialised = true
      clearTimeout(initialisationTimer)
      URL.revokeObjectURL(bootstrap)
      resolveReady()
    } else if (data?.type === 'frame' && pending && pending.id === data.id) {
      clearTimeout(pending.timer)
      const request = pending
      pending = null
      request.resolve(
        assessDetectedPoses(Array.isArray(data.landmarks) ? data.landmarks : [])
      )
    }
  }
  try {
    worker.postMessage({
      type: 'init',
      modelPath: new URL(asset(POSE_MODEL_PATH), window.location.href).href,
      runtimeBase: new URL(asset(VISION_ASSET_PATH), window.location.href).href,
    })
  } catch {
    fail(new Error('Body guide unavailable'))
  }

  return {
    ready,
    dispose,
    async detect(
      video: HTMLVideoElement,
      timestamp: number
    ): Promise<LivePoseFrame> {
      if (closed || !initialised)
        throw new DOMException('Body guide closed', 'AbortError')
      if (pending || creatingFrame) throw new Error('Frame already pending')
      creatingFrame = true
      let bitmap: ImageBitmap | undefined
      try {
        const scale = Math.min(
          1,
          640 / Math.max(video.videoWidth, video.videoHeight)
        )
        try {
          bitmap = await createImageBitmap(video, {
            resizeWidth: Math.max(1, Math.round(video.videoWidth * scale)),
            resizeHeight: Math.max(1, Math.round(video.videoHeight * scale)),
          })
        } catch (error) {
          if (
            closed ||
            !(
              error instanceof TypeError ||
              (error instanceof DOMException &&
                error.name === 'NotSupportedError')
            )
          )
            throw error
          bitmap = await createImageBitmap(video)
        }
        if (closed) throw new DOMException('Body guide closed', 'AbortError')
        const id = ++nextId
        return await new Promise<LivePoseFrame>((resolve, reject) => {
          pending = {
            id,
            resolve,
            reject,
            timer: setTimeout(() => fail(new Error('Frame timed out')), 4000),
          }
          try {
            worker.postMessage({ type: 'frame', id, bitmap, timestamp }, [
              bitmap!,
            ])
            bitmap = undefined
          } catch {
            bitmap?.close()
            bitmap = undefined
            fail(new Error('Body guide unavailable'))
          }
        })
      } finally {
        bitmap?.close()
        creatingFrame = false
      }
    },
  }
}
