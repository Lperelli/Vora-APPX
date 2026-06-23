import type { BodyTypeId } from '@/lib/body-type-analysis'

/**
 * VORA — Body-type classification config (single place to calibrate).
 *
 * Everything that decides a body type lives here so it can be re-tuned with
 * real photos and the client's styling criteria WITHOUT touching the classifier
 * logic. Both flows (photo via MediaPipe, manual via the form) feed the same
 * `classifyBodyType` in lib/body-classifier.ts using these numbers.
 *
 * Ratios used everywhere (scale-invariant, so camera distance does not matter):
 *   SHR = shoulderW / hipW   (shoulder-to-hip)
 *   WHR = waistW   / hipW    (waist-to-hip)
 *   WSR = waistW   / shoulderW (waist-to-shoulder)
 */

export const THRESHOLDS = {
  /** |SHR - 1| <= this  ⇒  shoulders ≈ hips (balanced top/bottom). */
  balancedTolerance: 0.07,

  /** WHR <= this  ⇒  waist clearly defined (needed for hourglass). */
  definedWaistWHR: 0.75,

  /**
   * WHR >= this  ⇒  little/no waist definition (apple).
   *
   * NOTE: the spec text suggested 0.85, but the §8 acceptance tests require
   * {100,92,100} (WHR 0.92) → rectangle and {100,98,100} (WHR 0.98) → apple.
   * 0.85 would misclassify the rectangle case as apple, so this is calibrated
   * to ~0.95 to satisfy those tests. RE-TUNE with real photos + the client's
   * styling judgement once sample data exists.
   */
  fullWaistWHR: 0.95,

  /** SHR >= this ⇒ shoulders notably wider; SHR <= 1/this ⇒ hips notably wider. */
  widerRatio: 1.05,

  /** Waist measurement row between shoulder (0) and hip (1) for the photo flow. */
  waistRowFactor: 0.55,
} as const

export type Thresholds = typeof THRESHOLDS

/**
 * Representative (SHR, WHR) "prototype" per type, used to produce the soft
 * match-percentage breakdown shown in the UI. These are starting points —
 * calibrate alongside THRESHOLDS. They do NOT decide the type (the thresholds
 * do); they only shape the score distribution and confidence.
 */
export const PROTOTYPES: Record<BodyTypeId, { SHR: number; WHR: number }> = {
  hourglass: { SHR: 1.0, WHR: 0.7 },
  rectangle: { SHR: 1.0, WHR: 0.85 },
  pear: { SHR: 0.85, WHR: 0.75 },
  apple: { SHR: 1.0, WHR: 0.98 },
  'inverted-triangle': { SHR: 1.15, WHR: 0.8 },
}

/** Average landmark visibility (photo flow) below which we never trust a result. */
export const PHOTO_VISIBILITY = {
  /** Below this ⇒ force low confidence and offer retry / manual. */
  low: 0.6,
  /** Below this ⇒ cap confidence at medium. */
  medium: 0.8,
} as const
