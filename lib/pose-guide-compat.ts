import { asset } from './base-path'
import { POSE_MODEL_PATH, POSE_WASM_BASE } from './photo-flow'
import { assessDetectedPoses, type LivePoseFrame } from './live-pose-guide'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'

/** Safari path: an explicit DOM canvas and the live video, with no bitmap transfer. */
export function createCompatibilityPoseGuide(
  options: { preferCPU?: boolean } = {}
) {
  let closed = false
  let detector: PoseLandmarker | null = null
  let canvas: HTMLCanvasElement | null = null
  let lastTimestamp = -1
  let rejectReady!: (error: Error) => void
  let resolveReady!: () => void
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  const release = () => {
    try {
      detector?.close()
    } catch {
      /* A lost context can already be closed. */
    }
    detector = null
    if (canvas) {
      // Release the explicit context, including when the model finishes after close.
      try {
        canvas
          .getContext('webgl2')
          ?.getExtension('WEBGL_lose_context')
          ?.loseContext()
      } catch {
        /* Unsupported context. */
      }
      canvas.width = canvas.height = 1
      canvas = null
    }
  }
  const dispose = () => {
    if (closed) return
    closed = true
    clearTimeout(timeout)
    release()
    rejectReady(new DOMException('Body guide closed', 'AbortError'))
  }
  const timeout = setTimeout(() => {
    rejectReady(
      new Error(
        'Body tracking download timed out. Check your connection and retry.'
      )
    )
    dispose()
  }, 40000)

  void (async () => {
    // Bundled with Vora: Safari does not need to import the JS library inside a worker.
    const { FilesetResolver, PoseLandmarker } = await import(
      '@mediapipe/tasks-vision'
    )
    if (closed) return
    const fileset = await FilesetResolver.forVisionTasks(POSE_WASM_BASE)
    if (closed) return
    const delegates: Array<'GPU' | 'CPU'> = options.preferCPU
      ? ['CPU']
      : ['GPU', 'CPU']
    for (const delegate of delegates) {
      canvas = document.createElement('canvas')
      const currentCanvas = canvas
      try {
        const instance = await PoseLandmarker.createFromOptions(fileset, {
          canvas: currentCanvas,
          baseOptions: { modelAssetPath: asset(POSE_MODEL_PATH), delegate },
          runningMode: 'VIDEO',
          numPoses: 2,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        })
        if (closed) {
          instance.close()
          currentCanvas.width = currentCanvas.height = 1
          return
        }
        detector = instance
        clearTimeout(timeout)
        resolveReady()
        return
      } catch (error) {
        release()
        if (closed) return
        if (delegate === 'CPU') throw error
      }
    }
  })().catch(() => {
    if (closed) return
    rejectReady(
      new Error(
        'Body tracking could not load. Check your connection and retry.'
      )
    )
    dispose()
  })

  return {
    ready,
    dispose,
    async detect(
      video: HTMLVideoElement,
      timestamp: number
    ): Promise<LivePoseFrame> {
      if (closed || !detector)
        throw new DOMException('Body guide closed', 'AbortError')
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight)
        throw new Error('Waiting for a live camera frame')
      // VIDEO mode requires increasing timestamps, including after a camera interruption.
      lastTimestamp = Math.max(timestamp, lastTimestamp + 1)
      const result = detector.detectForVideo(video, lastTimestamp)
      return assessDetectedPoses(result.landmarks || [])
    },
  }
}
