import type { BodyTypeId } from '@/lib/body-type-analysis'
import { BODY_TYPE_IDS } from '@/lib/body-type-analysis'
import { THRESHOLDS as T, PROTOTYPES, PHOTO_VISIBILITY } from '@/lib/body-type-config'

/**
 * VORA — Single deterministic body-type classifier.
 *
 * Pure function: no DOM, no network, no randomness. Identical input always
 * yields identical output. Both the photo flow (silhouette widths in px) and
 * the manual flow (measurements in cm) call this exact function, so they can
 * never disagree. Portable as-is to a Webflow ES-module embed.
 */

export type Confidence = 'high' | 'medium' | 'low'

export interface BodyWidths {
  /** Upper-body width: shoulder span (photo) or shoulder/bust (manual). */
  shoulderW: number
  /** Narrowest mid-body width. */
  waistW: number
  /** Widest lower-body width. */
  hipW: number
  /** Photo flow only: mean landmark visibility 0..1 (lowers confidence). */
  visibility?: number
}

export interface ClassifyResult {
  type: BodyTypeId
  confidence: Confidence
  /** Match percentage per type (sums to ~100), for the UI breakdown. */
  scores: Record<BodyTypeId, number>
  ratios: { SHR: number; WHR: number; WSR: number }
}

function round(n: number, p = 3): number {
  const f = 10 ** p
  return Math.round(n * f) / f
}

/** Soft match distribution from distance to each type's prototype ratios. */
function computeScores(SHR: number, WHR: number): Record<BodyTypeId, number> {
  const EPS = 1e-3
  const raw: Record<BodyTypeId, number> = {} as Record<BodyTypeId, number>
  let total = 0
  for (const id of BODY_TYPE_IDS) {
    const p = PROTOTYPES[id]
    // Equal weighting of the two ratios; both are unitless and similar scale.
    const dist = Math.sqrt((SHR - p.SHR) ** 2 + (WHR - p.WHR) ** 2)
    const score = 1 / (dist + EPS)
    raw[id] = score
    total += score
  }
  const scores: Record<BodyTypeId, number> = {} as Record<BodyTypeId, number>
  for (const id of BODY_TYPE_IDS) {
    scores[id] = round((raw[id] / total) * 100, 1)
  }
  return scores
}

function decideType(SHR: number, WHR: number): BodyTypeId {
  // Order matters — see spec §7.
  if (WHR <= T.definedWaistWHR && Math.abs(SHR - 1) <= T.balancedTolerance) {
    return 'hourglass' // balanced top/bottom + defined waist
  }
  if (SHR >= T.widerRatio) {
    return 'inverted-triangle' // shoulders notably wider
  }
  if (SHR <= 1 / T.widerRatio) {
    return 'pear' // hips notably wider
  }
  if (WHR >= T.fullWaistWHR) {
    return 'apple' // balanced but little/no waist definition
  }
  return 'rectangle' // balanced with a soft waist
}

function deriveConfidence(type: BodyTypeId, scores: Record<BodyTypeId, number>, visibility?: number): Confidence {
  // Gap between the chosen type and the next-best type.
  const chosen = scores[type]
  let runnerUp = 0
  for (const id of BODY_TYPE_IDS) {
    if (id !== type && scores[id] > runnerUp) runnerUp = scores[id]
  }
  const gap = chosen - runnerUp

  let confidence: Confidence
  if (gap >= 18) confidence = 'high'
  else if (gap >= 8) confidence = 'medium'
  else confidence = 'low'

  // Photo flow: poor landmark visibility can only LOWER confidence.
  if (typeof visibility === 'number') {
    if (visibility < PHOTO_VISIBILITY.low) confidence = 'low'
    else if (visibility < PHOTO_VISIBILITY.medium && confidence === 'high') confidence = 'medium'
  }

  return confidence
}

export function classifyBodyType({ shoulderW, waistW, hipW, visibility }: BodyWidths): ClassifyResult {
  if (!(shoulderW > 0) || !(waistW > 0) || !(hipW > 0)) {
    throw new Error('classifyBodyType: widths must be positive numbers')
  }

  const SHR = round(shoulderW / hipW)
  const WHR = round(waistW / hipW)
  const WSR = round(waistW / shoulderW)

  const type = decideType(SHR, WHR)
  const scores = computeScores(SHR, WHR)
  const confidence = deriveConfidence(type, scores, visibility)

  return { type, confidence, scores, ratios: { SHR, WHR, WSR } }
}
