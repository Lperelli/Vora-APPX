/* Camera frames stay in this worker on the user's device. */
let landmarker

self.onmessage = async ({ data }) => {
  if (data?.type === 'init') {
    try {
      const { FilesetResolver, PoseLandmarker } = await import(`${data.runtimeBase}/vision_bundle.mjs`)
      const suffix = await FilesetResolver.isSimdSupported() ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal'
      const fileset = { wasmLoaderPath: `${data.runtimeBase}/${suffix}.js`, wasmBinaryPath: `${data.runtimeBase}/${suffix}.bin` }
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
