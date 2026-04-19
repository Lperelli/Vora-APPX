'use client'

import { Upload } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'

interface NotNowScreenProps {
  onUploadPhotos: () => void
  onFillQuiz: () => void
}

export function NotNowScreen({ onUploadPhotos, onFillQuiz }: NotNowScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const btn =
    'flex items-center justify-center gap-2.5 rounded-full bg-[#1a1a1a] text-white text-[11px] tracking-[0.22em] uppercase py-3.5 px-6 min-h-[48px] border border-white/[0.08] hover:bg-[#222] transition-colors'

  return (
    <motion.div
      className="min-h-screen bg-[#101010] text-white flex flex-col items-center justify-center px-6 py-12"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col items-center text-center max-w-lg w-full gap-8 md:gap-10">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16, filter: 'blur(14px)' }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <VoraLogo className="!text-white text-5xl md:text-6xl font-light" />
        </motion.div>

        <motion.div
          className="space-y-5 max-w-sm mx-auto"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(14px)' }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-xs tracking-[0.28em] uppercase text-white font-medium">Overwhelmed?</h2>
          <p className="text-sm text-white/85 leading-relaxed font-sans">
            {"We'll filter the most flattering options for your body type, just give us 3 minutes"}
          </p>
        </motion.div>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 w-full max-w-2xl"
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
          <span className="text-[11px] tracking-[0.25em] text-white uppercase px-0.5">OR</span>
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
