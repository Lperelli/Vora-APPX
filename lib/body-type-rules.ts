import type { BodyTypeId } from '@/lib/body-type-analysis'
import { thresholds } from '@/lib/body-criteria'

/**
 * VORA — Single deterministic body-type rule engine.
 *
 * This is the ONE place where a body type is decided. Both the measurements
 * path and the photo path funnel through the same criteria so the result is
 * exact and reproducible:
 *
 *  - Measurements → `classifyFromMeasurements` does pure arithmetic on ratios.
 *  - Photos      → the Groq vision model only *estimates* visual evidence
 *                  (shoulders vs hips, waist definition, torso dominance), and
 *                  `classifyFromVisualEvidence` maps that evidence to a type.
 *
 * The LLM is never the judge — it is the estimator (photos) or the copywriter
 * (measurements). Identical input always yields the identical body type.
 *
 * Every threshold lives in the editable criteria document
 * (lib/vora-body-criteria.json) so tuning never requires touching this logic.
 */

export type Confidence = 'high' | 'medium' | 'low'

function confidenceFromMargin(...margins: number[]): Confidence {
  const { confidence } = thresholds()
  const limiting = Math.min(...margins)
  if (limiting >= confidence.highMargin) return 'high'
  if (limiting >= confidence.mediumMargin) return 'medium'
  return 'low'
}

/** Return the more conservative of two confidence levels. */
export function lowerConfidence(a: Confidence, b: Confidence): Confidence {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }
  return rank[a] <= rank[b] ? a : b
}

export interface MeasurementInput {
  bustCm: number
  waistCm: number
  hipsCm: number
  /** Optional — used as upper-body proxy alongside bust when present. */
  shouldersCm?: number | null
  /** Collected for sizing; does NOT affect silhouette classification. */
  heightCm?: number | null
}

export interface DetectedRatios {
  upperToHip: number
  hipToUpper: number
  waistToHip: number
}

export interface BodyTypeDecision {
  bodyType: BodyTypeId
  confidence: Confidence
  ratios: DetectedRatios
  rationale: string
}

/**
 * Classify a body type from numeric measurements (cm). Pure, deterministic.
 * `upper` is the broader of shoulders/bust; bust is the proxy when shoulders
 * are absent. Height is ignored for classification.
 */
export function classifyFromMeasurements(input: MeasurementInput): BodyTypeDecision {
  const { bustCm, waistCm, hipsCm, shouldersCm } = input
  const t = thresholds()

  const upper = Math.max(shouldersCm ?? 0, bustCm)
  const waistToHip = round(waistCm / hipsCm)
  const hipToUpper = round(hipsCm / upper)
  const upperToHip = round(upper / hipsCm)

  // How much the upper body and hips differ, as a percentage of the larger.
  const imbalancePct = (Math.abs(upper - hipsCm) / Math.max(upper, hipsCm)) * 100
  // Positive while the frame is still within the "balanced" tolerance.
  const balanceMargin = (t.balanceTolerancePct - imbalancePct) / 100
  // Margin past the tolerance for a clearly dominant half.
  const dominanceMargin = (imbalancePct - t.balanceTolerancePct) / 100

  const ratios: DetectedRatios = { upperToHip, hipToUpper, waistToHip }
  const isDominant = imbalancePct >= t.balanceTolerancePct

  // Priority: a clearly dominant half wins before waist-based types.
  if (isDominant && hipsCm > upper) {
    return {
      bodyType: 'pear',
      confidence: confidenceFromMargin(dominanceMargin),
      ratios,
      rationale: `Hips exceed the upper body by ${imbalancePct.toFixed(1)}%.`,
    }
  }

  if (isDominant && upper > hipsCm) {
    return {
      bodyType: 'inverted-triangle',
      confidence: confidenceFromMargin(dominanceMargin),
      ratios,
      rationale: `Upper body exceeds the hips by ${imbalancePct.toFixed(1)}%.`,
    }
  }

  // Balanced frame → waist definition decides.
  if (waistToHip <= t.waistDefinedRatio) {
    return {
      bodyType: 'hourglass',
      confidence: confidenceFromMargin(t.waistDefinedRatio - waistToHip, balanceMargin),
      ratios,
      rationale: `Balanced frame with a defined waist (waist/hip ${waistToHip}).`,
    }
  }

  if (waistToHip >= t.waistFullRatio) {
    return {
      bodyType: 'apple',
      confidence: confidenceFromMargin(waistToHip - t.waistFullRatio, balanceMargin),
      ratios,
      rationale: `Balanced frame with little waist definition (waist/hip ${waistToHip}).`,
    }
  }

  return {
    bodyType: 'rectangle',
    confidence: confidenceFromMargin(waistToHip - t.waistDefinedRatio, t.waistFullRatio - waistToHip, balanceMargin),
    ratios,
    rationale: `Balanced frame with a soft waist (waist/hip ${waistToHip}).`,
  }
}

// ── Photo path: visual evidence → body type ───────────────────────────────

export interface VisualEvidence {
  shouldersVsHips: 'shoulders_wider' | 'hips_wider' | 'balanced' | 'unclear'
  waistDefinition: 'defined' | 'moderate' | 'minimal' | 'unclear'
  torsoDominance: 'upper' | 'middle' | 'lower' | 'balanced' | 'unclear'
}

export interface VisualDecision {
  /** Null when the evidence is too unclear to decide (caller may fall back). */
  bodyType: BodyTypeId | null
  confidence: Confidence
}

/**
 * Map the vision model's structured visual evidence to a body type using the
 * same conceptual rules as the measurement path. Deterministic given evidence.
 */
export function classifyFromVisualEvidence(e: VisualEvidence): VisualDecision {
  const { shouldersVsHips: s, waistDefinition: w, torsoDominance: t } = e
  let bodyType: BodyTypeId | null

  if (s === 'hips_wider') {
    bodyType = 'pear'
  } else if (s === 'shoulders_wider') {
    bodyType = 'inverted-triangle'
  } else if (s === 'balanced') {
    if (w === 'defined') bodyType = 'hourglass'
    else if (w === 'minimal' && t === 'middle') bodyType = 'apple'
    else bodyType = 'rectangle'
  } else {
    // shoulders vs hips unclear → lean on torso dominance.
    if (t === 'lower') bodyType = 'pear'
    else if (t === 'upper') bodyType = 'inverted-triangle'
    else if (t === 'middle' && (w === 'minimal' || w === 'unclear')) bodyType = 'apple'
    else if (w === 'defined') bodyType = 'hourglass'
    else if (t === 'balanced') bodyType = 'rectangle'
    else bodyType = null
  }

  const unclearCount = [s, w, t].filter((x) => x === 'unclear').length
  let confidence: Confidence
  if (bodyType === null) confidence = 'low'
  else if (unclearCount === 0) confidence = 'high'
  else if (unclearCount === 1) confidence = 'medium'
  else confidence = 'low'

  return { bodyType, confidence }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
