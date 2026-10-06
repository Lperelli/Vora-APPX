'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { BUILD_BASE } from '@/lib/base-path'
import { validLeadEmail } from '@/lib/leads'

interface EmailGateScreenProps {
  onSubmit: (email: string | null) => void
  onBack: () => void
}

/** Ask for an email only when a real destination is configured. */
export function EmailGateScreen({ onSubmit, onBack }: EmailGateScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availability, setAvailability] = useState<'checking' | 'available' | 'unavailable'>('checking')
  const requestId = useRef<string | null>(null)
  const inFlight = useRef(false)
  const valid = validLeadEmail(email.trim())

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const deadline = setTimeout(() => controller.abort(), 6000)
    void fetch(`${BUILD_BASE}/api/leads`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json()
        if (active) setAvailability(response.ok && result?.enabled === true ? 'available' : 'unavailable')
      })
      .catch(() => { if (active) setAvailability('unavailable') })
      .finally(() => clearTimeout(deadline))
    return () => { active = false; clearTimeout(deadline); controller.abort() }
  }, [])

  const submit = async () => {
    setTouched(true)
    if (!valid || inFlight.current || availability !== 'available') return
    inFlight.current = true
    setSaving(true)
    setError(null)
    requestId.current ??= crypto.randomUUID()
    try {
      const response = await fetch(`${BUILD_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), requestId: requestId.current }),
        signal: AbortSignal.timeout(20000),
      })
      const result = await response.json()
      if (response.status === 503) { setAvailability('unavailable'); return }
      if (!response.ok || result?.saved !== true) throw new Error('Not saved')
      onSubmit(email.trim())
    } catch {
      setError('We couldn’t confirm your email was saved. Try again or continue to your results.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background font-sans text-foreground">
      <VoraScreenHeader onReturn={() => { if (!inFlight.current) onBack() }} variant="onTheme" center={<VoraLogo />} />

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
        <motion.div
          className="mx-auto w-full max-w-[420px] text-center"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mb-2.5 text-[10px] uppercase tracking-[0.38em] text-foreground/55">Almost there</p>
          <h2 className="mb-3 text-lg font-semibold tracking-[0.06em] text-foreground sm:text-xl">
            Your style profile is ready
          </h2>
          <p className="mb-8 text-[13px] leading-relaxed text-foreground/50">
            {availability === 'available'
              ? <>Leave your email with VORA and view your results here. We won&apos;t email your results.</>
              : <>Your results are ready to view here, on your device.</>}
          </p>

          {availability === 'available' ? <>
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
              maxLength={254}
              required
              disabled={saving}
              placeholder="you@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); requestId.current = null; setError(null) }}
              onBlur={() => setTouched(true)}
              aria-label="Email address"
              aria-invalid={touched && !valid}
              aria-describedby="lead-privacy"
              className="h-[50px] w-full rounded-[10px] border border-white/[0.18] bg-white/[0.02] px-4 text-sm text-foreground outline-none transition-[border-color,background-color] duration-300 placeholder:text-foreground/30 focus:border-foreground focus:bg-white/[0.04]"
            />
            {touched && !valid && (
              <p className="px-1 text-[11px] text-rose-300/80">Please enter a valid email.</p>
            )}
            {error && <p role="alert" className="px-1 text-xs leading-relaxed text-rose-300">{error}</p>}
            <motion.button
              type="submit"
              disabled={!valid || saving}
              aria-busy={saving}
              className="mt-2 h-[50px] w-full rounded-[10px] bg-foreground text-[11px] uppercase tracking-[0.22em] text-background transition-all duration-300 hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-[0.32]"
              whileHover={!valid || prefersReducedMotion ? undefined : { scale: 1.01 }}
              whileTap={!valid || prefersReducedMotion ? undefined : { scale: 0.99 }}
            >
              {saving ? 'Saving your email…' : 'Save email & see results'}
            </motion.button>
          </form>

          <p id="lead-privacy" className="mt-6 text-[11px] leading-relaxed text-foreground/50">
            By saving your email, you agree that VORA saves your email and registration date in its private Google Sheet. Your photos and measurements stay on your device.{' '}
            <Link href="/privacy" className="underline underline-offset-4">Privacy notice</Link>
          </p>
          {error && <button type="button" onClick={() => onSubmit(null)} className="mt-5 min-h-11 text-xs text-foreground/65 underline underline-offset-4">Continue to my results</button>}
          </> : <>
            <button type="button" disabled={availability === 'checking'} onClick={() => onSubmit(null)} className="h-[50px] w-full rounded-[10px] bg-foreground text-[11px] uppercase tracking-[0.22em] text-background transition-colors hover:bg-foreground/90 disabled:opacity-40">
              {availability === 'checking' ? 'Preparing your results…' : 'See my results'}
            </button>
            <p role="status" className="mt-6 text-[11px] leading-relaxed text-foreground/50">
              {availability === 'checking' ? 'Just a moment.' : <>No email is needed. Your photos and measurements stay on your device.{' '}<Link href="/privacy" className="underline underline-offset-4">Privacy notice</Link></>}
            </p>
          </>}
        </motion.div>
      </div>
    </div>
  )
}
