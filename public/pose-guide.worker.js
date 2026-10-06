/* Camera frames stay in this worker on the user's device. */
let landmarker

self.onmessage = async ({ data }) => {
  if (data?.type === 'init') {
    try {
      // Keep this exact version in sync with photo-flow.ts and package.json.
      const { FilesetResolver, PoseLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs')
      const fileset = await FilesetResolver.forVisionTasks(data.wasmBase)
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: data.modelPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      })
      try { landmarker = await PoseLandmarker.createFromOptions(fileset, options('GPU')) }
      catch { landmarker = await PoseLandmarker.createFromOptions(fileset, options('CPU')) }
      self.postMessage({ type: 'ready' })
    } catch { self.postMessage({ type: 'error' }) }
  } else if (data?.type === 'frame') {
    try {
      if (!landmarker) throw new Error('Not ready')
      const result = landmarker.detectForVideo(data.bitmap, data.timestamp)
      self.postMessage({ type: 'frame', id: data.id, landmarks: result.landmarks })
    } catch { self.postMessage({ type: 'error' }) }
    finally { data.bitmap?.close() }
  }
}
