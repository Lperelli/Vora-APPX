import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const model = vi.hoisted(() => ({ create: vi.fn(), detect: vi.fn() }))
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  PoseLandmarker: { createFromOptions: model.create },
}))
beforeEach(() => {
  vi.resetModules()
  model.create.mockReset().mockResolvedValue({ detect: model.detect })
  model.detect.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

function fixture() {
  const bitmap = { close: vi.fn() }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95, z: 0 }))
  points[0].y = 0.08
  points[11].y = points[12].y = 0.25
  points[23].y = points[24].y = 0.55
  points[27].y = points[28].y = 0.92
  const mask = { width: 100, height: 100, close: vi.fn(), getAsFloat32Array: vi.fn(() => {
    const values = new Float32Array(10000)
    for (let y = 0; y < 100; y++) values.fill(1, y * 100 + 20, y * 100 + 80)
    return values
  }) }
  return { bitmap, points, mask, result: { landmarks: [points], segmentationMasks: [mask] } }
}

describe('single-photo analysis resources', () => {
  it('accepts one clear full-length photo and closes bitmap and segmentation mask', async () => {
    const data = fixture(); model.detect.mockReturnValue(data.result)
    const { measureFromImage } = await import('./photo-flow')
    const result = await measureFromImage(new Blob(['synthetic']))
    expect(result.ok).toBe(true)
    expect(result.widths).toMatchObject({ shoulderW: 60, waistW: 60, hipW: 60 })
    expect(data.bitmap.close).toHaveBeenCalledOnce()
    expect(data.mask.close).toHaveBeenCalledOnce()
  })
  it('closes resources even if no body was detected', async () => {
    const data = fixture(); model.detect.mockReturnValue({ ...data.result, landmarks: [] })
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).reason).toBe('no_body')
    expect(data.bitmap.close).toHaveBeenCalledOnce()
    expect(data.mask.close).toHaveBeenCalledOnce()
  })
  it('rejects cropped feet without demanding additional photos, and releases resources', async () => {
    const data = fixture(); data.points[27].y = 1.1; model.detect.mockReturnValue(data.result)
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).reason).toBe('not_full_body')
    expect(data.bitmap.close).toHaveBeenCalledOnce()
    expect(data.mask.close).toHaveBeenCalledOnce()
  })
  it('closes resources after a failed silhouette read', async () => {
    const data = fixture(); data.mask.getAsFloat32Array.mockImplementation(() => { throw new Error('Bad mask') }); model.detect.mockReturnValue(data.result)
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).reason).toBe('silhouette_unreadable')
    expect(data.bitmap.close).toHaveBeenCalledOnce()
    expect(data.mask.close).toHaveBeenCalledOnce()
  })
  it('allows retry after model initialisation failed on both GPU and CPU', async () => {
    const data = fixture(); model.detect.mockReturnValue(data.result)
    model.create.mockRejectedValueOnce(new Error('GPU unavailable')).mockRejectedValueOnce(new Error('CPU unavailable'))
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).reason).toBe('load_failed')
    expect((await measureFromImage(new Blob())).ok).toBe(true)
    expect(model.create).toHaveBeenCalledTimes(3)
  })
})
