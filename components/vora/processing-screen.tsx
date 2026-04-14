'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'

const STEPS = [
  'Measurements received',
  'Body shape identified',
  'Style profile created',
]

interface ProcessingScreenProps {
  isComplete: boolean
  onComplete: () => void
}

export function ProcessingScreen({ isComplete, onComplete }: ProcessingScreenProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const calledRef = useRef(false)
  const prefersReducedMotion = useReducedMotion()

  // Animate steps in, one every 800ms
  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => {
        setCompletedSteps((prev) => (prev.includes(i) ? prev : [...prev, i]))
      }, 600 + i * 900)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  // Once API is done AND all steps shown, proceed
  useEffect(() => {
    if (isComplete && completedSteps.length === STEPS.length && !calledRef.current) {
      calledRef.current = true
      const t = setTimeout(onComplete, 700)
      return () => clearTimeout(t)
    }
  }, [isComplete, completedSteps.length, onComplete])

  return (
    <motion.div
      className="min-h-screen bg-background flex flex-col items-center justify-between py-12 px-6"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: -10, filter: 'blur(14px)' }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <VoraLogo />
      </motion.div>

      <div className="flex flex-col items-center gap-14 w-full max-w-lg">
        {/* Step indicators — stacked on mobile, row on md+ */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-14 w-full">
          {STEPS.map((label, i) => (
            <motion.div
              key={i}
              className={`flex items-center gap-2 transition-all duration-700 ${
                completedSteps.includes(i) ? 'opacity-100 translate-y-0' : 'opacity-20 translate-y-1'
              }`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={prefersReducedMotion ? undefined : { opacity: completedSteps.includes(i) ? 1 : 0.25, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <Check
                className={`w-3.5 h-3.5 shrink-0 transition-colors duration-300 ${
                  completedSteps.includes(i) ? 'text-foreground' : 'text-muted-foreground'
                }`}
              />
              <span className="text-xs text-foreground/80 tracking-wide">{label}</span>
            </motion.div>
          ))}
        </div>

        {/* Loading dots while waiting for API */}
        {!isComplete && (
          <motion.div
            className="flex items-center gap-1.5"
            aria-label="Analyzing"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </motion.div>
        )}

        {/* Done state */}
        {isComplete && completedSteps.length === STEPS.length && (
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
        className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        Privacy First / Processed Locally, Never Stored
      </motion.p>
    </motion.div>
  )
}
