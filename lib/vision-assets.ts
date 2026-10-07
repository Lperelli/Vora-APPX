import { asset } from './base-path'

export const VISION_VERSION = '0.10.35'
export const VISION_ASSET_PATH = `/vision/${VISION_VERSION}`
export const POSE_MODEL_PATH = '/models/pose_landmarker_full.task'

/** Explicit filenames keep browser WASM out of Webflow's Worker module bundle. */
export function visionFileset(simd: boolean) {
  const name = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal'
  return {
    wasmLoaderPath: asset(`${VISION_ASSET_PATH}/${name}.js`),
    wasmBinaryPath: asset(`${VISION_ASSET_PATH}/${name}.bin`),
  }
}
