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
      className="min-h-screen bg-background flex flex-col items-center justify-center gap-16 px-6 py-12"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(14px)' }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <VoraLogo className="text-6xl" />
      </motion.div>

      <motion.div
        className="text-center space-y-6 max-w-sm"
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
        className="flex flex-wrap items-center justify-center gap-4"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.button
          onClick={onUploadPhotos}
          className="flex items-center gap-2.5 rounded-full bg-[oklch(0.16_0_0)] border border-foreground/15 text-foreground text-xs tracking-[0.2em] uppercase py-4 px-7 hover:bg-[oklch(0.20_0_0)] transition-colors"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        >
          <Upload className="w-4 h-4" />
          Upload Photos
        </motion.button>
        <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">or</span>
        <motion.button
          onClick={onFillQuiz}
          className="flex items-center gap-2.5 rounded-full bg-[oklch(0.16_0_0)] border border-foreground/15 text-foreground text-xs tracking-[0.2em] uppercase py-4 px-7 hover:bg-[oklch(0.20_0_0)] transition-colors"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        >
          Fill Up Quiz
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
