'use client'

import { Upload } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { VORA_FLOW_MAX } from './vora-layout'

interface NotNowScreenProps {
  onBack: () => void
  onUploadPhotos: () => void
  onFillQuiz: () => void
}

export function NotNowScreen({ onBack, onUploadPhotos, onFillQuiz }: NotNowScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const btn =
    'flex min-h-[48px] w-full max-w-[min(100%,320px)] items-center justify-center gap-2.5 rounded-full border border-foreground/15 bg-[oklch(0.14_0_0)] px-5 py-3.5 text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-[oklch(0.18_0_0)] sm:w-auto sm:max-w-none sm:px-6 sm:tracking-[0.22em]'

  return (
    <motion.div
      className="flex min-h-[100dvh] flex-col items-stretch bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-0 text-foreground sm:px-6"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <VoraScreenHeader onReturn={onBack} variant="onTheme" center={<VoraLogo />} />

      <div
        className={`flex flex-1 flex-col items-center justify-center text-center ${VORA_FLOW_MAX} gap-8 md:gap-10 min-h-0 py-8 sm:py-12 px-3 sm:px-4`}
      >

        <motion.div
          className="space-y-5 max-w-2xl lg:max-w-3xl mx-auto w-full px-1"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(14px)' }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-xs font-medium uppercase tracking-[0.28em] text-foreground">Overwhelmed?</h2>
          <p className="font-sans text-sm leading-relaxed text-foreground/85">
            {"We'll filter the most flattering options for your body type, just give us 3 minutes"}
          </p>
        </motion.div>

        <motion.div
          className="flex w-full max-w-2xl flex-col items-stretch justify-center gap-3 px-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-3 sm:gap-y-3"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.button
            type="button"
            onClick={onUploadPhotos}
            className={btn}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            <Upload className="w-4 h-4 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
            Upload Photos
          </motion.button>
          <span className="px-0.5 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground sm:px-0.5">
            OR
          </span>
          <motion.button
            type="button"
            onClick={onFillQuiz}
            className={btn}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            Fill Up Quiz
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  )
}
