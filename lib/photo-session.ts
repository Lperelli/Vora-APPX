import { classifyBodyType, type BodyWidths, type ClassifyResult } from './body-classifier'
import { PHOTO_VISIBILITY } from './body-type-config'

export interface PhotoSessionCandidate {
  /** Original position in the selected photos, retained after quality filtering. */
  index: number
  widths: BodyWidths
}

export type PhotoSessionAssessment = {
  ok: true
  classification: ClassifyResult
  widths: BodyWidths
  usedIndices: number[]
  excludedIndices: number[]
  usedPhotoCount: number
  evidence: 'single-photo' | 'consistent-photos'
} | {
  ok: false
  reason: 'no_usable_photos' | 'inconsistent_photos' | 'invalid_photo_count'
  usedIndices: number[]
  excludedIndices: number[]
}

// A compatibility guard in hip-normalized image widths, not a calibrated error
// bound or a claim of anatomical accuracy. Compare every pair, so a third image
// cannot bridge two otherwise incompatible views into a fabricated consensus.
const MAX_RATIO_SPREAD = 0.08

function usable(widths: BodyWidths): boolean {
  return [widths.shoulderW, widths.waistW, widths.hipW].every(
    (n) => Number.isFinite(n) && n > 0
  ) &&
    [widths.shoulderW / widths.hipW, widths.waistW / widths.hipW].every(Number.isFinite) &&
    (widths.visibility === undefined ||
      (Number.isFinite(widths.visibility) && widths.visibility >= PHOTO_VISIBILITY.low))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Candidates must already have passed the same frontal/standing photo checks.
 * One useful library photo is as usable as one camera photo. Extra unsuitable
 * photos must not erase it, but conflicting usable photos cannot be ignored.
 */
export function assessPhotoSession(
  candidates: PhotoSessionCandidate[],
  source: 'camera' | 'library'
): PhotoSessionAssessment {
  const fail = (reason: 'no_usable_photos' | 'inconsistent_photos' | 'invalid_photo_count'): PhotoSessionAssessment => ({
    ok: false, reason, usedIndices: [], excludedIndices: candidates.map((item) => item.index),
  })
  if (source === 'camera' && candidates.length !== 1) return fail('invalid_photo_count')
  const valid = candidates.filter((item) => usable(item.widths))
  if (!valid.length) return fail('no_usable_photos')

  const shoulders = valid.map(({ widths }) => widths.shoulderW / widths.hipW)
  const waists = valid.map(({ widths }) => widths.waistW / widths.hipW)
  if ([shoulders, waists].some((values) => Math.max(...values) - Math.min(...values) > MAX_RATIO_SPREAD)) {
    return fail('inconsistent_photos')
  }

  const widths = valid.length === 1 ? { ...valid[0].widths } : {
    shoulderW: median(shoulders),
    waistW: median(waists),
    hipW: 1,
    visibility: Math.min(...valid.map((item) => item.widths.visibility ?? 1)),
  }
  const classification = classifyBodyType(widths)
  const types = new Set(valid.map((item) => classifyBodyType(item.widths).type))
  // Prototype distance is a heuristic styling match, not measured accuracy.
  // A single view or views straddling a category boundary remain tentative.
  classification.confidence = valid.length === 1 || types.size > 1
    ? 'low'
    : classification.confidence === 'high' ? 'medium' : classification.confidence

  return {
    ok: true,
    classification,
    widths,
    usedIndices: valid.map((item) => item.index),
    excludedIndices: candidates.filter((item) => !usable(item.widths)).map((item) => item.index),
    usedPhotoCount: valid.length,
    evidence: valid.length === 1 ? 'single-photo' : 'consistent-photos',
  }
}

/** Compatibility wrapper; use assessPhotoSession to preserve photo provenance. */
export function combinePhotoWidths(items: BodyWidths[], source: 'camera' | 'library'): BodyWidths | null {
  const result = assessPhotoSession(items.map((widths, index) => ({ index, widths })), source)
  return result.ok ? result.widths : null
}

/** Compatibility wrapper for callers that only need the tentative profile. */
export function classifyPhotoSession(items: BodyWidths[], source: 'camera' | 'library'): ClassifyResult | null {
  const result = assessPhotoSession(items.map((widths, index) => ({ index, widths })), source)
  return result.ok ? result.classification : null
}
