import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preparePhoto } from './photo-image'

let photo: {
  naturalWidth: number
  naturalHeight: number
  onload: null | (() => void)
  onerror: null | (() => void)
  src: string
  removeAttribute: ReturnType<typeof vi.fn>
}
let canvas: {
  width: number
  height: number
  getContext: ReturnType<typeof vi.fn>
}
const drawImage = vi.fn()
beforeEach(() => {
  vi.useFakeTimers()
  photo = {
    naturalWidth: 3024,
    naturalHeight: 4032,
    onload: null,
    onerror: null,
    src: '',
    removeAttribute: vi.fn(),
  }
  canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage })) }
  vi.stubGlobal('Image', function () {
    return photo
  })
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:local-test'),
    revokeObjectURL: vi.fn(),
  })
  // Photo analysis must also work in browsers without ImageBitmap.
  vi.stubGlobal('createImageBitmap', undefined)
  drawImage.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('photo decoding', () => {
  it('decodes a phone photo without ImageBitmap, preserves its full proportions and releases resources', async () => {
    const pending = preparePhoto(new Blob(['photo']))
    photo.onload!()
    const result = await pending
    expect([canvas.width, canvas.height]).toEqual([1200, 1600])
    expect(drawImage).toHaveBeenCalledWith(photo, 0, 0, 1200, 1600)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-test')
    expect(photo.removeAttribute).toHaveBeenCalledWith('src')
    result.dispose()
    expect([canvas.width, canvas.height]).toEqual([0, 0])
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not enlarge small photos or crop a landscape photo', async () => {
    photo.naturalWidth = 800
    photo.naturalHeight = 600
    const pending = preparePhoto(new Blob(['photo']))
    photo.onload!()
    const result = await pending
    expect([canvas.width, canvas.height]).toEqual([800, 600])
    result.dispose()
  })
  it('rejects empty files before allocating resources', async () => {
    await expect(preparePhoto(new Blob())).rejects.toThrow('Empty image')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it('releases the object URL when the format is unsupported', async () => {
    const pending = preparePhoto(new Blob(['invalid']))
    photo.onerror!()
    await expect(pending).rejects.toThrow('format')
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('bounds a decoder that never responds, and detaches late callbacks', async () => {
    const pending = preparePhoto(new Blob(['photo']))
    const rejected = expect(pending).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(15000)
    await rejected
    expect(photo.onload).toBeNull()
    expect(photo.onerror).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })
  it('releases the decoded photo if a drawing context cannot be allocated', async () => {
    canvas.getContext.mockReturnValue(null)
    const pending = preparePhoto(new Blob(['photo']))
    photo.onload!()
    await expect(pending).rejects.toThrow('canvas')
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
    expect([canvas.width, canvas.height]).toEqual([0, 0])
  })
})
