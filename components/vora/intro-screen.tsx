'use client'

import { Clock, Upload } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { VORA_FLOW_MAX } from './vora-layout'

interface IntroScreenProps {
  onBack: () => void
  onUploadPhotos: () => void
  onEnterMeasurements: () => void
}

export function IntroScreen({ onBack, onUploadPhotos, onEnterMeasurements }: IntroScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const container = prefersReducedMotion
    ? {}
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.08, delayChildren: 0.14 } },
      }
  const item = prefersReducedMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 14, filter: 'blur(14px)' },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
      }
  return (
    <motion.div
      className="min-h-screen bg-background flex flex-col items-stretch justify-between px-4 sm:px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-0"
      variants={container}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate={prefersReducedMotion ? undefined : 'show'}
    >
      <motion.div variants={item} className="w-full shrink-0">
        <VoraScreenHeader onReturn={onBack} variant="onTheme" center={<VoraLogo />} />
      </motion.div>

      <div
        className={`flex-1 flex flex-col items-center justify-center text-center ${VORA_FLOW_MAX} gap-8 sm:gap-10 px-3 sm:px-4 min-h-0 py-6`}
      >
        <motion.div className="w-full max-w-2xl lg:max-w-3xl mx-auto space-y-5 sm:space-y-6" variants={item}>
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-[0.12em] uppercase text-foreground">
            We know online fitting is a struggle.
          </h2>
          <p className="text-sm sm:text-base text-foreground/70 leading-relaxed">
            {"That's why we make the science of styling available to everyone. Try VORA and get personalized outfits that will flatter you the most according to your body type."}
          </p>
          <div className="flex items-center justify-center gap-2 text-foreground/60">
            <Clock className="w-4 h-4" />
            <span className="text-sm">3 min</span>
          </div>
        </motion.div>

        <motion.div className="flex flex-col gap-4 w-full max-w-md lg:max-w-lg mx-auto" variants={item}>
          <motion.button
            onClick={onUploadPhotos}
            className="flex items-center justify-center gap-3 w-full rounded-full border border-foreground/20 bg-[oklch(0.14_0_0)] text-foreground text-xs tracking-[0.2em] uppercase py-4 px-6 hover:bg-[oklch(0.18_0_0)] transition-colors"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            <Upload className="w-4 h-4" />
            Upload Photos
          </motion.button>
          <p className="text-xs text-muted-foreground text-center tracking-widest uppercase">or</p>
          <motion.button
            onClick={onEnterMeasurements}
            className="flex items-center justify-center gap-3 w-full rounded-full border border-foreground/20 bg-[oklch(0.14_0_0)] text-foreground text-xs tracking-[0.2em] uppercase py-4 px-6 hover:bg-[oklch(0.18_0_0)] transition-colors"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            Enter Measurements
          </motion.button>
        </motion.div>
      </div>

      <motion.p
        className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase text-center px-4 shrink-0 pb-2"
        variants={item}
      >
        Privacy First / Processed Locally, Never Stored
      </motion.p>
    </motion.div>
  )
}
