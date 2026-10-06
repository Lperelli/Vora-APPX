import { describe, it, expect } from 'vitest'
import { combinePhotoWidths } from './photo-session'
const square = { shoulderW: 100, waistW: 85, hipW: 100, visibility: 0.95 }
const triangle = { shoulderW: 85, waistW: 75, hipW: 100, visibility: 0.95 }
const hourglass = { shoulderW: 100, waistW: 70, hipW: 100, visibility: 0.95 }
describe('separate photo methods', () => {
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
