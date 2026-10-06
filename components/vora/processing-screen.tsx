'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { FigmaFlowShell } from './figma-flow-shell'

interface ProcessingScreenProps {
  isComplete: boolean
  onComplete: () => void
  onReturn: () => void
  source?: 'photo' | 'measurement'
}

/** Figma 3075:151 → 3075:142 → 3075:133, driven by completed local analysis. */
export function ProcessingScreen({
  isComplete,
  onComplete,
  onReturn,
  source = 'photo',
}: ProcessingScreenProps) {
  const [completedCount, setCompletedCount] = useState(1)
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!isComplete) {
      setCompletedCount(1)
      return
    }
    setCompletedCount(reducedMotion ? 3 : 2)
    const reveal = setTimeout(
      () => setCompletedCount(3),
      reducedMotion ? 0 : 420
    )
    const advance = setTimeout(
      () => completeRef.current(),
      reducedMotion ? 300 : 1270
    )
    return () => {
      clearTimeout(reveal)
      clearTimeout(advance)
    }
  }, [isComplete, reducedMotion])

  return (
    <ProcessingView
      completedCount={completedCount}
      source={source}
      onReturn={onReturn}
    />
  )
}

export function ProcessingView({
  completedCount,
  source = 'photo',
  onReturn,
}: {
  completedCount: number
  source?: 'photo' | 'measurement'
  onReturn: () => void
}) {
  const done = completedCount === 3
  const steps = [
    source === 'photo' ? 'Photos received' : 'Measurements received',
    'Body shape identified',
    'Style profile created',
  ]
  return (
    <FigmaFlowShell
      onReturn={onReturn}
      nodeId={
        done ? '3075:133' : completedCount === 2 ? '3075:142' : '3075:151'
      }
    >
      <section className="mx-auto w-full max-w-[564px] px-5 pt-10">
        <ol
          className="flex flex-col justify-between gap-3 text-[12px] leading-[26px] tracking-[-0.3125px] sm:flex-row sm:gap-10"
          aria-label="Analysis progress"
        >
          {steps.map((label, index) => (
            <li
              key={label}
              className={`w-full sm:w-[148px] sm:shrink-0 ${completedCount > index ? 'opacity-100' : completedCount === 2 ? 'opacity-20' : 'opacity-30'}`}
            >
              <span aria-hidden>✓ </span>
              {label}
            </li>
          ))}
        </ol>
        <p
          role="status"
          aria-live="polite"
          className={`mt-[144px] text-center font-medium uppercase leading-5 tracking-[2px] ${done ? 'text-[12px]' : 'text-[10px]'}`}
        >
          {done ? 'Got them!' : 'Loading results...'}
        </p>
      </section>
    </FigmaFlowShell>
  )
}
