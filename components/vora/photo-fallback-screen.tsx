'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { FigmaFlowShell } from './figma-flow-shell'
import { VORA_FLOW_MAX } from './vora-layout'

export type PhotoIssue =
  | 'not_front_facing'
  | 'arms_obscured'
  | 'posture'
  | 'inconsistent_photos'
  | 'no_body'
  | 'multiple_bodies'
  | 'not_full_body'
  | 'low_visibility'
  | 'silhouette_unreadable'
  | 'image_decode_failed'
  | 'load_failed'
  | 'low_confidence'

const MESSAGES: Record<PhotoIssue, string> = {
  not_front_facing: 'Turn towards the camera. A side view changes the proportions we can see.',
  arms_obscured: 'Relax your arms slightly away from your waist so we can see your torso clearly.',
  posture: 'Stand upright and face forward with your weight balanced on both feet.',
  inconsistent_photos: 'We couldn’t find two consistent, usable views in these photos. Try three clear front-facing photos, or use your measurements.',
  no_body: "We couldn't find a full body in that photo. Try a clear, front-facing, head-to-toe shot.",
  multiple_bodies: 'There is more than one person in this photo. Take a photo with only you in the frame.',
  not_full_body: 'We need your whole body in frame, head to toe. Step back and try again.',
  low_visibility: 'The photo was a little unclear. Better lighting and fitted clothes help a lot.',
  silhouette_unreadable: "We couldn't read your silhouette. Fitted clothing against a plain background works best.",
  image_decode_failed: "This browser couldn't open that photo. Try a JPG or PNG, or take a new photo with the camera.",
  load_failed: "The photo analyzer couldn't start. Check your connection and retry. You can also enter your measurements.",
  low_confidence:
    "We couldn’t find a consistent style profile from this photo. For a clearer view, the photo needs to be front-facing, full-body, with fitted clothing — or you can enter measurements.",
}

interface PhotoFallbackScreenProps {
  issue: PhotoIssue
  onRetryPhoto: () => void
  onEnterMeasurements: () => void
  onBack: () => void
}

/**
 * Shown when the photo flow can't produce a trustworthy result (spec §5/§9).
 * Never presents a low-confidence guess as exact — offers retry or the more
 * accurate manual path instead.
 */
export function PhotoFallbackScreen({ issue, onRetryPhoto, onEnterMeasurements, onBack }: PhotoFallbackScreenProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <FigmaFlowShell onReturn={onBack}>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
        <motion.div
          className={`${VORA_FLOW_MAX} max-w-[440px] text-center`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mb-3 text-[10px] uppercase tracking-[0.38em] text-foreground/55">Let&apos;s refine this</p>
          <p className="mb-9 text-[14px] leading-relaxed text-foreground/70">{MESSAGES[issue]}</p>

          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
            <motion.button
              type="button"
              onClick={onRetryPhoto}
              className="h-[50px] w-full rounded-full border border-foreground/20 bg-[oklch(0.14_0_0)] text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-[oklch(0.18_0_0)]"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            >
              Retry photo
            </motion.button>
            <motion.button
              type="button"
              onClick={onEnterMeasurements}
              className="h-[50px] w-full rounded-full bg-foreground text-[11px] uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/90"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            >
              Enter measurements
            </motion.button>
          </div>
        </motion.div>
      </div>
    </FigmaFlowShell>
  )
}
