'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'

interface WelcomeScreenProps {
  onStart: () => void
  onSkip: () => void
}

export function WelcomeScreen({ onStart, onSkip }: WelcomeScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <div className="min-h-[100dvh] bg-white text-black flex flex-col">
      {/* Header — no RETURN on home (design) */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-5 sm:py-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <span className="w-16 shrink-0" aria-hidden />
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -8, filter: 'blur(14px)' }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Image
            src="/brand/vora-logo@2x.png"
            alt="Vora"
            width={202}
            height={48}
            priority
            className="h-6 w-auto select-none"
            sizes="(max-width: 768px) 120px, 160px"
          />
        </motion.div>
        <span className="w-16" />
      </header>

      {/* Photo grid with overlay card */}
      <div className="relative flex-1 mx-4 md:mx-8 mb-4 overflow-hidden rounded-2xl bg-white">
        <div className="relative w-full max-w-[1024px] mx-auto">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.03, filter: 'blur(18px)' }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/home/home.png"
              alt="Vora hero grid"
              width={2120}
              height={1200}
              priority
              className="w-full h-auto"
              sizes="(max-width: 100%) 100vw, 1024px"
            />
          </motion.div>
        </div>

        {/* Overlay card */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="bg-[oklch(0.12_0_0/0.92)] backdrop-blur-sm rounded-2xl px-10 py-8 mx-4 max-w-sm w-full text-center border border-white/10"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98, filter: 'blur(18px)' }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.75, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs tracking-[0.2em] text-white/60 uppercase mb-2">Overwhelmed?</p>
            <p className="text-sm text-white/80 leading-relaxed mb-8">
              {"We'll filter the most flattering options for your body type, just give us 3 minutes"}
            </p>
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={onStart}
                className="w-full rounded-full border border-white/30 bg-transparent text-white text-xs tracking-[0.25em] uppercase py-3.5 px-6 hover:bg-white/10 transition-colors"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              >
                Start
              </motion.button>
              <motion.button
                onClick={onSkip}
                className="w-full rounded-full border border-white/10 bg-transparent text-white/50 text-xs tracking-[0.25em] uppercase py-3.5 px-6 hover:bg-white/5 transition-colors"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              >
                Not Now
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Privacy footer */}
      <footer className="text-center py-6">
        <motion.p
          className="text-[10px] tracking-[0.25em] text-black/50 uppercase"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          Privacy First / Processed Locally, Never Stored
        </motion.p>
      </footer>
    </div>
  )
}
