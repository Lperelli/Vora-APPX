'use client'

import { Upload } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'

interface NotNowScreenProps {
  onBack: () => void
  onUploadPhotos: () => void
  onFillQuiz: () => void
}

export function NotNowScreen({ onBack, onUploadPhotos, onFillQuiz }: NotNowScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const btn =
    'flex items-center justify-center gap-2.5 rounded-full bg-[#1a1a1a] text-white text-[11px] tracking-[0.22em] uppercase py-3.5 px-6 min-h-[48px] border border-white/[0.08] hover:bg-[#222] transition-colors'

  return (
    <motion.div
      className="min-h-screen bg-[#101010] text-white flex flex-col items-stretch px-4 sm:px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-0"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <VoraScreenHeader
        onReturn={onBack}
        variant="onDark"
        center={<VoraLogo className="h-8 w-auto sm:h-10 md:h-12" />}
      />

      <div className="flex flex-1 flex-col items-center justify-center text-center max-w-lg w-full mx-auto gap-8 md:gap-10 min-h-0 py-8 sm:py-12">

        <motion.div
          className="space-y-5 max-w-sm mx-auto w-full px-1"
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
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 w-full max-w-2xl px-1"
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
