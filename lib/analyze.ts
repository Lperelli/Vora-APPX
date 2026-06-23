import { buildAnalysisFromBodyType, type BodyAnalysis } from '@/lib/body-type-analysis'
import { classifyBodyType, type ClassifyResult } from '@/lib/body-classifier'

/**
 * Bridges the pure classifier to the app's `BodyAnalysis` (presets + styling
 * copy). The body type and confidence come from `classifyBodyType`; ALL styling
 * text comes from curated presets — never from an LLM.
 */

export function buildAnalysisFromClassification(
  result: ClassifyResult,
  source: 'photo' | 'measurement'
): BodyAnalysis {
  return {
    ...buildAnalysisFromBodyType(result.type, result.confidence),
    scores: result.scores,
    analysisSource: source,
  }
}

export interface ManualMeasurements {
  bustCm: number
  waistCm: number
  hipsCm: number
  /** Optional; used as the upper-body width when present. */
  shouldersCm?: number | null
  /** Collected for sizing only; not used for classification. */
  heightCm?: number | null
}

/**
 * Manual flow: turn measurements into the shared classifier's widths and run
 * the exact same `classifyBodyType` the photo flow uses. Bust (or shoulders,
 * if provided) is the upper-body width.
 */
export function analyzeMeasurements(m: ManualMeasurements): BodyAnalysis {
  const upperW = m.shouldersCm && m.shouldersCm > 0 ? Math.max(m.shouldersCm, m.bustCm) : m.bustCm
  const result = classifyBodyType({ shoulderW: upperW, waistW: m.waistCm, hipW: m.hipsCm })
  return buildAnalysisFromClassification(result, 'measurement')
}
