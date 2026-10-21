import { describe, it, expect } from 'vitest'
import { assessPhotoSession, combinePhotoWidths, classifyPhotoSession } from './photo-session'
import type { BodyWidths } from './body-classifier'

const square = { shoulderW: 100, waistW: 85, hipW: 100, visibility: 0.95 }
const triangle = { shoulderW: 85, waistW: 75, hipW: 100, visibility: 0.95 }
const hourglass = { shoulderW: 100, waistW: 70, hipW: 100, visibility: 0.95 }
const candidates = (items: BodyWidths[]) => items.map((widths, index) => ({ index, widths }))

describe('photo evidence selection', () => {
  it('keeps the only useful library view, its original index and a tentative profile', () => {
    const result = assessPhotoSession([
      { index: 0, widths: { ...square, visibility: 0.2 } },
      { index: 2, widths: square },
      { index: 1, widths: { ...square, hipW: NaN } },
    ], 'library')
    expect(result).toMatchObject({
      ok: true, usedIndices: [2], excludedIndices: [0, 1], usedPhotoCount: 1,
      evidence: 'single-photo', classification: { type: 'rectangle', confidence: 'low' },
    })
    expect(combinePhotoWidths([square], 'library')).toEqual(square)
  })

  it('requires exactly one camera candidate and rejects unreadable inputs', () => {
    expect(combinePhotoWidths([square], 'camera')).toEqual(square)
    expect(assessPhotoSession([], 'camera')).toMatchObject({ ok: false, reason: 'invalid_photo_count' })
    expect(combinePhotoWidths([square, square], 'camera')).toBeNull()
    expect(combinePhotoWidths([square, { ...square, hipW: NaN }], 'camera')).toBeNull()
    for (const widths of [
      { ...square, hipW: NaN },
      { ...square, visibility: NaN },
      { ...square, visibility: 0.2 },
      { ...square, hipW: Number.MIN_VALUE },
    ]) expect(classifyPhotoSession([widths], 'camera')).toBeNull()
    expect(assessPhotoSession([], 'library')).toMatchObject({ ok: false, reason: 'no_usable_photos' })
  })

  it('normalizes camera distance before comparing and combining usable views', () => {
    const result = assessPhotoSession(candidates([
      square,
      { ...square, shoulderW: 200, waistW: 170, hipW: 200 },
      { ...square, shoulderW: 50, waistW: 42.5, hipW: 50 },
    ]), 'library')
    expect(result).toMatchObject({
      ok: true, usedIndices: [0, 1, 2], usedPhotoCount: 3, evidence: 'consistent-photos',
      widths: { shoulderW: 1, waistW: 0.85, hipW: 1 },
      classification: { type: 'rectangle', confidence: 'medium' },
    })
  })

  it('accepts close ratios straddling a category boundary without claiming certainty', () => {
    const result = assessPhotoSession(candidates([
      { ...square, shoulderW: 104.5 },
      { ...square, shoulderW: 105.5 },
    ]), 'library')
    expect(result).toMatchObject({
      ok: true, usedPhotoCount: 2, classification: { confidence: 'low' },
    })
  })

  it('does not ignore a conflicting usable photo just because two others agree', () => {
    const result = assessPhotoSession(candidates([square, square, triangle]), 'library')
    expect(result).toEqual({
      ok: false, reason: 'inconsistent_photos', usedIndices: [], excludedIndices: [0, 1, 2],
    })
    expect(classifyPhotoSession([square, triangle, hourglass], 'library')).toBeNull()
  })

  it('rejects incompatible ratios even if their broad category is identical', () => {
    expect(classifyPhotoSession([square, { ...square, waistW: 110 }], 'library')).toBeNull()
  })

  it('does not let a middle image bridge two incompatible views', () => {
    expect(classifyPhotoSession([
      { ...square, waistW: 78 }, { ...square, waistW: 84 }, { ...square, waistW: 90 },
    ], 'library')).toBeNull()
  })

  it('does not turn an already tentative profile into high confidence', () => {
    const tentative = { shoulderW: 256, waistW: 283, hipW: 219, visibility: 0.9994 }
    expect(classifyPhotoSession([tentative], 'camera')).toMatchObject({
      type: 'inverted-triangle', confidence: 'low',
    })
    expect(classifyPhotoSession([tentative, tentative], 'library')).toMatchObject({ confidence: 'low' })
  })
})
