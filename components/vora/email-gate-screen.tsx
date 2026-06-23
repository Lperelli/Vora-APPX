'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { VORA_FLOW_MAX } from './vora-layout'

interface EmailGateScreenProps {
  onSubmit: (email: string) => void
  onBack: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Native email-capture gate shown right before results (business rule §9).
 * No external mail app — a normal in-page form. The email is captured client
 * side; results unlock on submit.
 */
export function EmailGateScreen({ onSubmit, onBack }: EmailGateScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const valid = EMAIL_RE.test(email.trim())

  const submit = () => {
    setTouched(true)
    if (valid) onSubmit(email.trim())
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background font-sans text-foreground">
      <VoraScreenHeader onReturn={onBack} variant="onTheme" center={<VoraLogo />} />

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
        <motion.div
          className={`${VORA_FLOW_MAX} max-w-[420px] text-center`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mb-2.5 text-[10px] uppercase tracking-[0.38em] text-foreground/55">Almost there</p>
          <h2 className="mb-3 text-lg font-semibold tracking-[0.06em] text-foreground sm:text-xl">
            Share your email to get your results
          </h2>
          <p className="mb-8 text-[13px] leading-relaxed text-foreground/50">
            We&apos;ll send your personalized style profile and keep your picks handy.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
            className="space-y-3 text-left"
          >
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-label="Email address"
              className="h-[50px] w-full rounded-[10px] border border-white/[0.18] bg-white/[0.02] px-4 text-sm text-foreground outline-none transition-[border-color,background-color] duration-300 placeholder:text-foreground/30 focus:border-foreground focus:bg-white/[0.04]"
            />
            {touched && !valid && (
              <p className="px-1 text-[11px] text-rose-300/80">Please enter a valid email.</p>
            )}
            <motion.button
              type="submit"
              disabled={!valid}
              className="mt-2 h-[50px] w-full rounded-[10px] bg-foreground text-[11px] uppercase tracking-[0.22em] text-background transition-all duration-300 hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-[0.32]"
              whileHover={!valid || prefersReducedMotion ? undefined : { scale: 1.01 }}
              whileTap={!valid || prefersReducedMotion ? undefined : { scale: 0.99 }}
            >
              See my results
            </motion.button>
          </form>

          <p className="mt-6 text-[8px] uppercase tracking-[0.24em] text-foreground/35">
            Privacy First / Processed Locally, Never Stored
          </p>
        </motion.div>
      </div>
    </div>
  )
}
