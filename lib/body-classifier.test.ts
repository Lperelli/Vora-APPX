import { describe, it, expect } from 'vitest'
import { classifyBodyType } from '@/lib/body-classifier'

describe('classifyBodyType — representative ratios (spec §8)', () => {
  it('hourglass: balanced shoulders/hips + defined waist', () => {
    expect(classifyBodyType({ shoulderW: 100, waistW: 70, hipW: 100 }).type).toBe('hourglass')
  })

  it('pear: hips notably wider than shoulders', () => {
    expect(classifyBodyType({ shoulderW: 90, waistW: 80, hipW: 110 }).type).toBe('pear')
  })

  it('inverted-triangle: shoulders notably wider than hips', () => {
    expect(classifyBodyType({ shoulderW: 115, waistW: 90, hipW: 95 }).type).toBe('inverted-triangle')
  })

  it('rectangle: balanced with a soft (not absent) waist', () => {
    expect(classifyBodyType({ shoulderW: 100, waistW: 92, hipW: 100 }).type).toBe('rectangle')
  })

  it('apple: balanced with essentially no waist definition', () => {
    expect(classifyBodyType({ shoulderW: 100, waistW: 98, hipW: 100 }).type).toBe('apple')
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
