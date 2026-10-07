import { describe, it, expect } from 'vitest'
import { combinePhotoWidths, classifyPhotoSession } from './photo-session'
const square = { shoulderW: 100, waistW: 85, hipW: 100, visibility: 0.95 }
const triangle = { shoulderW: 85, waistW: 75, hipW: 100, visibility: 0.95 }
const hourglass = { shoulderW: 100, waistW: 70, hipW: 100, visibility: 0.95 }
describe('separate photo methods', () => {
  // Real model output from a readable full-body test photo: the old UI discarded
  // it solely because its prototype-score gap was low, after decoding succeeded.
  const tentative = { shoulderW: 256, waistW: 283, hipW: 219, visibility: 0.9994 }
  it('returns a tentative camera profile without upgrading its confidence', () => {
    expect(classifyPhotoSession([tentative], 'camera')).toMatchObject({
      type: 'inverted-triangle', confidence: 'low',
    })
  })
  it('compares readable tentative library views instead of silently discarding them', () => {
    const farther = { ...tentative, shoulderW: 128, waistW: 141.5, hipW: 109.5 }
    expect(classifyPhotoSession([tentative, farther, triangle], 'library')).toMatchObject({
      type: 'inverted-triangle', confidence: 'low',
    })
  })
  it('still rejects unusable visibility and empty or conflicting photo sessions', () => {
    expect(classifyPhotoSession([], 'camera')).toBeNull()
    expect(classifyPhotoSession([{ ...tentative, visibility: 0.2 }], 'camera')).toBeNull()
    expect(classifyPhotoSession([{ ...tentative, visibility: NaN }], 'camera')).toBeNull()
    expect(classifyPhotoSession([square, triangle, hourglass], 'library')).toBeNull()
  })
  it('accepts exactly one valid live photo', () => {
    expect(combinePhotoWidths([square], 'camera')).toEqual(square)
    expect(combinePhotoWidths([square, square], 'camera')).toBeNull()
    expect(combinePhotoWidths([square, { ...square, hipW: NaN }], 'camera')).toBeNull()
  })
  it('requires at least two usable agreeing views from the library', () => {
    expect(combinePhotoWidths([square], 'library')).toBeNull()
    expect(combinePhotoWidths([square, square], 'library')).not.toBeNull()
  })
  it('normalizes distance and excludes a disagreeing outlier', () => {
    expect(
      combinePhotoWidths(
        [
          square,
          { ...square, shoulderW: 200, waistW: 170, hipW: 200 },
          triangle,
        ],
        'library'
      )
    ).toMatchObject({ shoulderW: 1, waistW: 0.85, hipW: 1 })
  })
  it('does not average incompatible photos into a fabricated consensus', () =>
    expect(
      combinePhotoWidths([square, triangle, hourglass], 'library')
    ).toBeNull())
  it('discards nonfinite inputs', () =>
    expect(combinePhotoWidths([{ ...square, hipW: NaN }], 'camera')).toBeNull())
})
