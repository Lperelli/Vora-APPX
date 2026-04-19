'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'

const STEPS = [
  'Measurements received',
  'Body shape identified',
  'Style profile created',
]

interface ProcessingScreenProps {
  /** True when the /api/analyze request has finished (success or fallback). */
  isComplete: boolean
  onComplete: () => void
  onReturn: () => void
  source?: 'photo' | 'measurement'
}

/**
 * Loading UX tied to the real API: early steps tick on a gentle rhythm while Groq runs;
 * the final step completes only when `isComplete` is true, then we transition out.
 */
export function ProcessingScreen({ isComplete, onComplete, onReturn, source = 'photo' }: ProcessingScreenProps) {
  /** Number of steps completed (0–3). Step 3 = all checks done. */
  const [completedCount, setCompletedCount] = useState(0)
  const calledRef = useRef(false)
  const prefersReducedMotion = useReducedMotion()

  // While API runs: reveal first two steps on a believable cadence (does not imply "done").
  useEffect(() => {
    if (isComplete) return
    if (prefersReducedMotion) return
    const t1 = setTimeout(() => setCompletedCount((n) => Math.max(n, 1)), 750)
    const t2 = setTimeout(() => setCompletedCount((n) => Math.max(n, 2)), 2100)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [isComplete, prefersReducedMotion])

  // When API returns: fill any missing steps quickly, then mark the third.
  useEffect(() => {
    if (!isComplete) return
    if (prefersReducedMotion) {
      setCompletedCount(3)
      return
    }
    const a = setTimeout(() => setCompletedCount((n) => Math.max(n, 1)), 0)
    const b = setTimeout(() => setCompletedCount((n) => Math.max(n, 2)), 180)
    const c = setTimeout(() => setCompletedCount(3), 420)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
      clearTimeout(c)
    }
  }, [isComplete, prefersReducedMotion])

  useEffect(() => {
    if (!isComplete || completedCount < 3 || calledRef.current) return
    calledRef.current = true
    const t = setTimeout(onComplete, 850)
    return () => clearTimeout(t)
  }, [isComplete, completedCount, onComplete])

  const analyzingLabel =
    source === 'measurement' ? 'AI is analyzing your measurements' : 'AI is analyzing your photos'

  return (
    <motion.div
      className="min-h-[100dvh] bg-background flex flex-col items-stretch justify-between px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <VoraScreenHeader onReturn={onReturn} variant="onTheme" center={<VoraLogo />} />

      <div className="flex flex-1 flex-col items-center justify-center gap-10 sm:gap-12 w-full max-w-lg mx-auto py-8 min-h-0">
        <p className="text-center text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.22em] text-muted-foreground uppercase px-3">
          {isComplete ? 'Analysis complete' : analyzingLabel}
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-5 sm:gap-8 md:gap-14 w-full px-2">
          {STEPS.map((label, i) => {
            const done = completedCount > i
            return (
              <motion.div
                key={i}
                className={`flex items-center gap-2 transition-all duration-700 ${
                  done ? 'opacity-100 translate-y-0' : 'opacity-25 translate-y-1'
                }`}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={prefersReducedMotion ? undefined : { opacity: done ? 1 : 0.28, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <Check
                  className={`w-3.5 h-3.5 shrink-0 transition-colors duration-300 ${
                    done ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                />
                <span className="text-xs text-foreground/80 tracking-wide">{label}</span>
              </motion.div>
            )
          })}
        </div>

        {!isComplete && (
          <motion.div
            className="flex flex-col items-center gap-4"
            aria-label="Analyzing with AI"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-foreground/35 animate-bounce"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </div>
            <p className="text-[10px] text-foreground/45 tracking-wide text-center max-w-xs leading-relaxed px-2">
              {source === 'measurement'
                ? 'This usually takes a few seconds. Longer waits mean we are still processing your data.'
                : 'This usually takes a few seconds. Longer waits mean we are still processing your images.'}
            </p>
          </motion.div>
        )}

        {isComplete && completedCount >= 3 && (
          <motion.p
            className="text-sm tracking-[0.35em] uppercase text-foreground"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12, filter: 'blur(14px)' }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            Got them!
          </motion.p>
        )}
      </div>

      <motion.p
        className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase text-center px-4 shrink-0"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        Privacy First / Processed Locally, Never Stored
      </motion.p>
    </motion.div>
  )
}
