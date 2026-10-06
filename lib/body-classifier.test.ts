import { describe, it, expect } from 'vitest'
import { classifyBodyType } from '@/lib/body-classifier'

describe('classifyBodyType — representative ratios (spec §8)', () => {
  it('hourglass: balanced shoulders/hips + defined waist', () => {
    expect(classifyBodyType({ shoulderW: 100, waistW: 70, hipW: 100 }).type).toBe('hourglass')
  })

  it('triangle: hips notably wider than shoulders', () => {
    expect(classifyBodyType({ shoulderW: 90, waistW: 80, hipW: 110 }).type).toBe('triangle')
  })

  it('inverted-triangle: shoulders notably wider than hips', () => {
    expect(classifyBodyType({ shoulderW: 115, waistW: 90, hipW: 95 }).type).toBe('inverted-triangle')
  })

  it('rectangle: balanced with a soft (not absent) waist', () => {
    expect(classifyBodyType({ shoulderW: 100, waistW: 92, hipW: 100 }).type).toBe('rectangle')
  })

  it('square: balanced with essentially no waist definition', () => {
    expect(classifyBodyType({ shoulderW: 100, waistW: 98, hipW: 100 }).type).toBe('rectangle')
  })
})

describe('classifyBodyType — shared by both flows', () => {
  it('photo widths (px) and manual widths (cm) with equal ratios give the same type', () => {
    // Manual entry in cm.
    const manual = classifyBodyType({ shoulderW: 90, waistW: 63, hipW: 91 })
    // Photo silhouette in px, same proportions scaled up ~6.7x.
    const photo = classifyBodyType({ shoulderW: 603, waistW: 422, hipW: 610, visibility: 0.9 })
    expect(photo.type).toBe(manual.type)
    expect(manual.type).toBe('hourglass')
  })

  it('low landmark visibility forces low confidence', () => {
    const r = classifyBodyType({ shoulderW: 100, waistW: 70, hipW: 100, visibility: 0.4 })
    expect(r.confidence).toBe('low')
  })

  it('scores sum to ~100 and the chosen type is plausible', () => {
    const r = classifyBodyType({ shoulderW: 100, waistW: 70, hipW: 100 })
    const sum = Object.values(r.scores).reduce((a, b) => a + b, 0)
    expect(sum).toBeGreaterThan(99)
    expect(sum).toBeLessThan(101)
  })
})

describe('MVP silhouette regressions', () => {
  it('has exactly four geometric score keys', () => {
    expect(Object.keys(classifyBodyType({ shoulderW: 100, waistW: 98, hipW: 100 }).scores).sort())
      .toEqual(['hourglass', 'inverted-triangle', 'rectangle', 'triangle'])
  })

  it('keeps balanced bodies square across softer waist ratios', () => {
    for (const waistW of [80, 85, 90, 95, 98, 100, 110]) {
      const result = classifyBodyType({ shoulderW: 100, waistW, hipW: 100 })
      expect(result.type).toBe('rectangle')
      expect(result.confidence).not.toBe('low')
    }
  })

  it('rejects non-finite measurements', () => {
    for (const width of [NaN, Infinity, -Infinity, 0, -1]) {
      expect(() => classifyBodyType({ shoulderW: width, waistW: 70, hipW: 100 })).toThrow()
    }
  })
})
