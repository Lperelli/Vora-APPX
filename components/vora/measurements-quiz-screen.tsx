'use client'

import { useCallback, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { MeasurementBodyWireframe, type MeasurementFocusField } from './measurement-body-wireframe'
import { VoraScreenHeader } from './screen-return-button'

export interface MeasurementsPayload {
  bust: number
  waist: number
  hips: number
  height: number
}

interface MeasurementsQuizScreenProps {
  onBack: () => void
  onSubmitMeasurements: (data: MeasurementsPayload) => void
}

function sanitizeCm(raw: string): string {
  return raw.replace(/[^\d]/g, '').slice(0, 3)
}

function toNum(s: string): number {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

export function MeasurementsQuizScreen({ onBack, onSubmitMeasurements }: MeasurementsQuizScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const [bust, setBust] = useState('')
  const [waist, setWaist] = useState('')
  const [hips, setHips] = useState('')
  const [height, setHeight] = useState('')
  const [focusField, setFocusField] = useState<MeasurementFocusField>(null)
  /** 0 = SHOW ME THE RESULTS, 1 = SUBMIT (second step) */
  const [ctaPhase, setCtaPhase] = useState<0 | 1>(0)

  const bustN = toNum(bust)
  const waistN = toNum(waist)
  const hipsN = toNum(hips)
  const heightN = toNum(height)

  const allValid = bustN > 0 && waistN > 0 && hipsN > 0 && heightN > 0

  const handlePrimary = useCallback(() => {
    if (!allValid) return
    if (ctaPhase === 0) {
      setCtaPhase(1)
      return
    }
    onSubmitMeasurements({ bust: bustN, waist: waistN, hips: hipsN, height: heightN })
  }, [allValid, bustN, waistN, hipsN, heightN, ctaPhase, onSubmitMeasurements])

  const ctaLabel = ctaPhase === 0 ? 'SHOW ME THE RESULTS' : 'SUBMIT'

  const fieldShell = useMemo(
    () =>
      'w-full h-[48px] sm:h-[52px] rounded-[14px] bg-[#141414] border border-white/[0.12] px-3.5 sm:px-4 text-sm text-white placeholder:text-white/22 outline-none transition-[border-color,background-color,box-shadow] duration-300 ease-out focus:border-white focus:bg-[#161616] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] disabled:opacity-40',
    []
  )

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col font-sans">
      <VoraScreenHeader
        onReturn={onBack}
        variant="onDark"
        center={<VoraLogo className="h-8 w-auto sm:h-10 md:h-12" />}
      />

      {/* Centered block: form + wireframe (design: one visual group, centered on large screens) */}
      <div className="flex-1 flex flex-col items-center justify-start lg:justify-center px-4 sm:px-6 pb-[max(5.5rem,env(safe-area-inset-bottom))] pt-2 sm:pt-4 min-h-0">
        <div className="w-full max-w-[920px] flex flex-col lg:flex-row items-center lg:items-start justify-center gap-10 lg:gap-14 xl:gap-20">
          <motion.div
            className="w-full max-w-[420px] shrink-0 text-center"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[10px] tracking-[0.38em] text-white/55 uppercase mb-2.5">Measurements</p>
            <p className="text-[13px] leading-relaxed text-white/42 mb-8 sm:mb-10 tracking-[0.01em] px-1">
              Please provide your measurements, madam.
            </p>

            <div className="space-y-6 sm:space-y-7 text-left mx-auto w-full">
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-2">
                  <span className="text-[11px] tracking-[0.06em] text-white/92">Bust (cm)</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={bust}
                  onChange={(e) => setBust(sanitizeCm(e.target.value))}
                  onFocus={() => setFocusField('bust')}
                  onBlur={() => setFocusField((f) => (f === 'bust' ? null : f))}
                  className={fieldShell}
                  aria-label="Bust in centimeters"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-2">
                  <span className="text-[11px] tracking-[0.06em] text-white/92">Waist (cm)</span>
                  <span className="text-[10px] italic text-white/38 tracking-wide">Narrowest part of mid body</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={waist}
                  onChange={(e) => setWaist(sanitizeCm(e.target.value))}
                  onFocus={() => setFocusField('waist')}
                  onBlur={() => setFocusField((f) => (f === 'waist' ? null : f))}
                  className={fieldShell}
                  aria-label="Waist in centimeters"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-2">
                  <span className="text-[11px] tracking-[0.06em] text-white/92">Hips (cm)</span>
                  <span className="text-[10px] italic text-white/38 tracking-wide">Widest part of bottom section of body</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={hips}
                  onChange={(e) => setHips(sanitizeCm(e.target.value))}
                  onFocus={() => setFocusField('hips')}
                  onBlur={() => setFocusField((f) => (f === 'hips' ? null : f))}
                  className={fieldShell}
                  aria-label="Hips in centimeters"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-2">
                  <span className="text-[11px] tracking-[0.06em] text-white/92">Height (cm)</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={height}
                  onChange={(e) => setHeight(sanitizeCm(e.target.value))}
                  onFocus={() => setFocusField('height')}
                  onBlur={() => setFocusField((f) => (f === 'height' ? null : f))}
                  className={fieldShell}
                  aria-label="Height in centimeters"
                />
              </div>
            </div>

            <motion.button
              type="button"
              disabled={!allValid}
              onClick={handlePrimary}
              className="mt-8 sm:mt-10 w-full h-[48px] sm:h-[52px] rounded-[14px] bg-[#1a1a1a] border border-white/[0.1] text-[10px] sm:text-[11px] tracking-[0.18em] sm:tracking-[0.22em] uppercase text-white/92 hover:bg-[#242424] hover:border-white/[0.14] disabled:opacity-[0.32] disabled:cursor-not-allowed transition-all duration-300 px-2"
              whileHover={!allValid || prefersReducedMotion ? undefined : { scale: 1.01 }}
              whileTap={!allValid || prefersReducedMotion ? undefined : { scale: 0.992 }}
            >
              {ctaLabel}
            </motion.button>
          </motion.div>

          <motion.div
            className="flex shrink-0 justify-center items-center w-full lg:w-auto lg:flex-1 pt-2 lg:pt-8 min-h-[200px] lg:min-h-[280px]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <MeasurementBodyWireframe
              bust={bustN}
              waist={waistN}
              hips={hipsN}
              height={heightN}
              focusField={focusField}
            />
          </motion.div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 py-4 sm:py-6 text-center pointer-events-none bg-gradient-to-t from-black via-black/90 to-transparent pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-[8px] sm:text-[9px] tracking-[0.24em] sm:tracking-[0.28em] uppercase text-white/38 px-3">
          Privacy First / Processed Locally, Never Stored
        </p>
      </footer>
    </div>
  )
}
