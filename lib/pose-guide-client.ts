import { createWorkerPoseGuide } from './pose-guide-worker-client'
import { createCompatibilityPoseGuide } from './pose-guide-compat'
import type { LivePoseFrame } from './live-pose-guide'

export type GuideState = 'loading' | 'recovering' | 'ready'
type Detector = ReturnType<typeof createWorkerPoseGuide>

/** WebKit's worker canvas/bitmap support differs from its normal video canvas. */
export function useCompatiblePoseGuide(userAgent: string) {
  return (
    /AppleWebKit/i.test(userAgent) &&
    !/(Chrome|Chromium|Edg|OPR)\//i.test(userAgent)
  )
}

/** Keep detection alive if worker creation, model setup or frame transfer fails. */
export function createPoseGuide(
  options: {
    onStateChange?: (state: GuideState) => void
    strategy?: 'auto' | 'compatibility'
  } = {}
) {
  let closed = false
  let busy = false
  let mode: 'worker' | 'compatibility' = 'worker'
  let detector: Detector | null = null
  let recovery: Promise<void> | null = null
  let retriedCompatibility = false
  const abort = () => new DOMException('Body guide closed', 'AbortError')
  const state = (value: GuideState) => {
    if (!closed) options.onStateChange?.(value)
  }

  const startCompatibility = (preferCPU = false) => {
    if (closed) return Promise.reject(abort())
    if (recovery && !preferCPU) return recovery
    mode = 'compatibility'
    detector?.dispose()
    state('recovering')
    detector = createCompatibilityPoseGuide({ preferCPU })
    recovery = detector.ready.then(() => {
      if (closed) throw abort()
      state('ready')
    })
    return recovery
  }

  const ready = (async () => {
    state('loading')
    if (
      options.strategy === 'compatibility' ||
      useCompatiblePoseGuide(navigator.userAgent) ||
      typeof Worker === 'undefined' ||
      typeof createImageBitmap === 'undefined'
    ) {
      await startCompatibility()
      return
    }
    try {
      detector = createWorkerPoseGuide()
      await detector.ready
      if (closed) throw abort()
      state('ready')
    } catch (error) {
      if (closed) throw error
      console.warn(
        '[Vora tracking] Worker startup failed; recovering with video.',
        error instanceof Error ? error.message : 'Unknown startup error'
      )
      await startCompatibility()
    }
  })()

  const detectWithRecovery = async (
    video: HTMLVideoElement,
    timestamp: number
  ): Promise<LivePoseFrame> => {
    if (closed || !detector) throw abort()
    try {
      return await detector.detect(video, timestamp)
    } catch (error) {
      if (closed) throw error
      if (mode === 'worker') {
        console.warn(
          '[Vora tracking] Worker frame failed; recovering with video.',
          error instanceof Error ? error.message : 'Unknown frame error'
        )
        await startCompatibility()
      } else if (!retriedCompatibility) {
        retriedCompatibility = true
        await startCompatibility(true)
      } else throw error
      if (closed) throw abort()
      return detectWithRecovery(video, performance.now())
    }
  }

  return {
    ready,
    get mode() {
      return mode
    },
    dispose() {
      if (closed) return
      closed = true
      detector?.dispose()
    },
    async detect(
      video: HTMLVideoElement,
      timestamp: number
    ): Promise<LivePoseFrame> {
      if (closed) throw abort()
      if (busy) throw new Error('Frame already pending')
      busy = true
      try {
        await ready
        return await detectWithRecovery(video, timestamp)
      } finally {
        busy = false
      }
    },
  }
}
