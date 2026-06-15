import criteria from '@/lib/vora-body-criteria.json'
import type { BodyTypeId } from '@/lib/body-type-analysis'

/**
 * Typed accessor for the editable criteria document
 * (lib/vora-body-criteria.json). This is the single source of truth shared by:
 *  - the deterministic rule engine (lib/body-type-rules.ts), and
 *  - the Groq vision prompt (lib/groq-classify.ts).
 *
 * Editing the JSON changes BOTH at once, so measurements and photos always
 * apply identical criteria. The engine makes the final decision — never the LLM.
 */

export interface CriteriaThresholds {
  balanceTolerancePct: number
  strongDominancePct: number
  waistDefinedRatio: number
  waistFullRatio: number
  confidence: { highMargin: number; mediumMargin: number }
}

const THRESHOLDS = criteria.thresholds as unknown as CriteriaThresholds
const BODY_TYPES = criteria.bodyTypes as Record<BodyTypeId, { label: string; measurementRule: string; promptDefinition: string }>
const PHOTO = criteria.photo

export function thresholds(): CriteriaThresholds {
  return THRESHOLDS
}

export function criteriaVersion(): number {
  return criteria.version
}

/** Ordered body types as listed in the criteria document. */
const ORDERED_TYPES: BodyTypeId[] = ['hourglass', 'rectangle', 'pear', 'apple', 'inverted-triangle']

/** Build the "BODY TYPE DEFINITIONS" block for the vision prompt from the JSON. */
export function buildBodyTypeDefinitions(): string {
  return ORDERED_TYPES.map((id, i) => {
    const def = BODY_TYPES[id]
    return `${i + 1}. "${id}"\n${def.promptDefinition}`
  }).join('\n\n')
}

/** Build the "CONFIDENCE CRITERIA" block for the vision prompt from the JSON. */
export function buildConfidenceCriteria(): string {
  const c = PHOTO.confidenceCriteria
  return `- "high": ${c.high}\n- "medium": ${c.medium}\n- "low": ${c.low}`
}

/** Allowed photo input-issue codes, sourced from the criteria document. */
export function photoInputIssues(): string[] {
  return PHOTO.inputIssues
}
