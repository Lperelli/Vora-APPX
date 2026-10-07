import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const model = vi.hoisted(() => ({ create: vi.fn(), detect: vi.fn() }))
const prepare = vi.hoisted(() => vi.fn())
vi.mock('./photo-image', () => ({ preparePhoto: prepare }))
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { isSimdSupported: vi.fn().mockResolvedValue({}) },
  PoseLandmarker: { createFromOptions: model.create },
}))
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('document', { createElement: vi.fn(() => ({ width: 1, height: 1 })) })
  model.create.mockReset().mockResolvedValue({ detect: model.detect })
  model.detect.mockReset()
  prepare.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

function fixture() {
  const bitmap = { close: vi.fn() }
  prepare.mockResolvedValue({ image: {}, dispose: bitmap.close })
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95, z: 0 }))
  points[0].y = 0.08
  points[11].y = points[12].y = 0.25
  points[23].y = points[24].y = 0.55
  points[11].x = points[23].x = 0.4
  points[12].x = points[24].x = 0.6
  points[15].x = 0.25; points[16].x = 0.75
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
  it('measures the torso, excluding separated arms on every sampled row', async () => {
    const data = fixture()
    data.mask.getAsFloat32Array.mockImplementation(() => {
      const values = new Float32Array(10000)
      for (let y=0; y<100; y++) {
        values.fill(1, y*100+40, y*100+60)
        values.fill(1, y*100+20, y*100+25)
        values.fill(1, y*100+75, y*100+80)
      }
      return values
    })
    model.detect.mockReturnValue(data.result)
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).widths).toMatchObject({ shoulderW: 20, waistW: 20, hipW: 20 })
  })
  it('uses neighbouring rows to tolerate a single segmentation outlier', async () => {
    const data = fixture()
    const original = data.mask.getAsFloat32Array()
    original.fill(1, 25*100, 26*100)
    data.mask.getAsFloat32Array.mockReturnValue(original)
    model.detect.mockReturnValue(data.result)
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).widths?.shoulderW).toBe(60)
  })
  it('rejects a detached segment far from the torso centre rather than measuring a limb', async () => {
    const data = fixture()
    data.mask.getAsFloat32Array.mockImplementation(() => {
      const values = new Float32Array(10000)
      for (let y=0; y<100; y++) values.fill(1, y*100+10, y*100+20)
      return values
    })
    model.detect.mockReturnValue(data.result)
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).reason).toBe('silhouette_unreadable')
  })
  it('does not select one of multiple people, and releases all masks', async () => {
    const data = fixture(); const secondMask = { ...data.mask, close: vi.fn() }
    model.detect.mockReturnValue({ landmarks: [data.points, data.points], segmentationMasks: [data.mask, secondMask] })
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).reason).toBe('multiple_bodies')
    expect(data.mask.close).toHaveBeenCalledOnce()
    expect(secondMask.close).toHaveBeenCalledOnce()
  })
})

describe('photo pose quality',()=>{
 it('rejects a marked side view before interpreting its silhouette',async()=>{
  const data=fixture();data.points[12].z=0.5;data.points[24].z=0.5;model.detect.mockReturnValue(data.result)
  const {measureFromImage}=await import('./photo-flow')
  expect((await measureFromImage(new Blob())).reason).toBe('not_front_facing')
  expect(data.mask.close).toHaveBeenCalledOnce()
 })
 it('rejects arms crossing the waist and still releases the image',async()=>{
  const data=fixture();data.points[15].x=0.5;model.detect.mockReturnValue(data.result)
  const {measureFromImage}=await import('./photo-flow')
  expect((await measureFromImage(new Blob())).reason).toBe('arms_obscured')
  expect(data.bitmap.close).toHaveBeenCalledOnce()
 })
})


describe('photo analysis sessions', () => {
  it('distinguishes an unreadable image from a model download failure', async () => {
    prepare.mockRejectedValue(new Error('Unsupported format'))
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob(['image']))).reason).toBe('image_decode_failed')
    expect(model.create).not.toHaveBeenCalled()
  })
  it('keeps a valid result if a mask was already closed, and still frees the photo', async () => {
    const data = fixture(); model.detect.mockReturnValue(data.result)
    data.mask.close.mockImplementation(() => { throw new Error('Context lost') })
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).ok).toBe(true)
    expect(data.bitmap.close).toHaveBeenCalledOnce()
  })
  it('times out a stalled model and closes an instance that arrives later', async () => {
    vi.useFakeTimers()
    try {
      const data = fixture(); const close = vi.fn()
      let finish!: (value: unknown) => void
      model.create.mockImplementation(() => new Promise(resolve => { finish = resolve }))
      const { measureFromImage } = await import('./photo-flow')
      const result = measureFromImage(new Blob())
      await vi.advanceTimersByTimeAsync(45001)
      expect((await result).reason).toBe('load_failed')
      expect(data.bitmap.close).toHaveBeenCalledOnce()
      finish({ close, detect: model.detect })
      await vi.advanceTimersByTimeAsync(1)
      expect(close).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })
  it('reuses a model for three library images and releases it once at the end', async () => {
    const data = fixture(), close = vi.fn()
    model.detect.mockReturnValue(data.result)
    model.create.mockResolvedValue({ detect: model.detect, close })
    const { createPhotoAnalyzer } = await import('./photo-flow')
    const analyzer = createPhotoAnalyzer()
    for (let i = 0; i < 3; i++) expect((await analyzer.measure(new Blob())).ok).toBe(true)
    expect(model.create).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    analyzer.dispose(); analyzer.dispose()
    expect(close).toHaveBeenCalledOnce()
    expect((await analyzer.measure(new Blob())).reason).toBe('load_failed')
  })
  it('releases the single-photo model even when the pose is rejected', async () => {
    const data = fixture(), close = vi.fn()
    model.detect.mockReturnValue({ ...data.result, landmarks: [] })
    model.create.mockResolvedValue({ detect: model.detect, close })
    const { measureFromImage } = await import('./photo-flow')
    expect((await measureFromImage(new Blob())).reason).toBe('no_body')
    expect(close).toHaveBeenCalledOnce()
  })
  it('closes a model that finishes loading after its session was cancelled', async () => {
    fixture()
    let finish!: (value: unknown) => void
    const close = vi.fn()
    model.create.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const { createPhotoAnalyzer } = await import('./photo-flow')
    const analyzer = createPhotoAnalyzer(), result = analyzer.measure(new Blob())
    await vi.waitFor(() => expect(model.create).toHaveBeenCalledOnce())
    analyzer.dispose(); finish({ close, detect: model.detect })
    expect((await result).reason).toBe('load_failed')
    expect(close).toHaveBeenCalledOnce()
  })
})
