import { describe, expect, it } from 'vitest'
import { visionFileset, VISION_VERSION } from './vision-assets'
import { readFileSync } from 'node:fs'

describe('browser vision assets', () => {
  it.each([true, false])(
    'serves the matching runtime and binary from Vora (SIMD %s)',
    (simd) => {
      const files = visionFileset(simd)
      expect(files.wasmLoaderPath).toContain(
        `/vision/${VISION_VERSION}/vision_wasm_${simd ? '' : 'nosimd_'}internal.js`
      )
      expect(files.wasmBinaryPath).toBe(
        files.wasmLoaderPath.replace(/\.js$/, '.bin')
      )
      expect(files.wasmBinaryPath).not.toMatch(/^https:\/\/cdn/)
    }
  )
  it('keeps the generated assets pinned to the installed model library', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(pkg.dependencies['@mediapipe/tasks-vision']).toBe(VISION_VERSION)
    expect(pkg.scripts.build).toContain('prepare-vision-assets.mjs')
  })
})
