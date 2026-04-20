'use client'

import { Upload } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'

interface OverwhelmedScreenProps {
  onUploadPhotos: () => void
  onFillQuiz: () => void
}

export function OverwhelmedScreen({ onUploadPhotos, onFillQuiz }: OverwhelmedScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-10 bg-background px-4 py-10 sm:gap-16 sm:px-6 sm:py-12"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(14px)' }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <VoraLogo />
      </motion.div>

      <motion.div
        className="max-w-sm space-y-5 px-2 text-center sm:space-y-6"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(14px)' }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-base tracking-[0.3em] uppercase text-foreground font-medium">
          Overwhelmed?
        </h2>
        <p className="text-sm text-foreground/70 leading-relaxed">
          {"We'll filter the most flattering options for your body type, just give us 3 minutes"}
        </p>
      </motion.div>

      <motion.div
        className="flex w-full max-w-md flex-col items-stretch gap-3 px-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.button
          onClick={onUploadPhotos}
          className="flex min-h-[48px] items-center justify-center gap-2.5 rounded-full border border-foreground/15 bg-[oklch(0.16_0_0)] px-6 py-4 text-xs uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-[oklch(0.20_0_0)] sm:px-7"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        >
          <Upload className="w-4 h-4" />
          Upload Photos
        </motion.button>
        <span className="py-0.5 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground sm:py-0">
          or
        </span>
        <motion.button
          onClick={onFillQuiz}
          className="flex min-h-[48px] items-center justify-center gap-2.5 rounded-full border border-foreground/15 bg-[oklch(0.16_0_0)] px-6 py-4 text-xs uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-[oklch(0.20_0_0)] sm:px-7"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        >
          Fill Up Quiz
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
