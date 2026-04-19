'use client'

import { useCallback, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { MeasurementBodyWireframe, type MeasurementFocusField } from './measurement-body-wireframe'

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
      'w-full h-[52px] rounded-[14px] bg-[#141414] border border-white/[0.12] px-4 text-sm text-white placeholder:text-white/22 outline-none transition-[border-color,background-color,box-shadow] duration-300 ease-out focus:border-white focus:bg-[#161616] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] disabled:opacity-40',
    []
  )

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <header className="relative flex items-center justify-center px-6 md:px-10 pt-8 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-6 md:left-10 top-8 text-[10px] tracking-[0.28em] uppercase text-white/45 hover:text-white/85 transition-colors"
        >
          Return
        </button>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <VoraLogo className="!text-white text-[2.75rem] md:text-[3.25rem] font-light leading-none" />
        </motion.div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-12 lg:gap-16 xl:gap-24 justify-center items-stretch lg:items-start max-w-[1100px] mx-auto w-full px-6 md:px-10 pt-6 pb-32">
        <motion.div
          className="w-full max-w-[420px] mx-auto lg:mx-0 shrink-0"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] tracking-[0.38em] text-white/55 uppercase text-center lg:text-left mb-2.5">
            Measurements
          </p>
          <p className="text-[13px] leading-relaxed text-white/42 text-center lg:text-left mb-10 tracking-[0.01em]">
            Please provide your measurements, madam.
          </p>

          <div className="space-y-7">
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
                placeholder=""
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
            className="mt-10 w-full h-[52px] rounded-[14px] bg-[#1a1a1a] border border-white/[0.1] text-[11px] tracking-[0.22em] uppercase text-white/92 hover:bg-[#242424] hover:border-white/[0.14] disabled:opacity-[0.32] disabled:cursor-not-allowed transition-all duration-300"
            whileHover={!allValid || prefersReducedMotion ? undefined : { scale: 1.01 }}
            whileTap={!allValid || prefersReducedMotion ? undefined : { scale: 0.992 }}
          >
            {ctaLabel}
          </motion.button>
        </motion.div>

        <motion.div
          className="flex flex-1 justify-center lg:justify-start items-center lg:items-start pt-2 lg:pt-6 min-h-[240px]"
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

      <footer className="fixed bottom-0 left-0 right-0 py-6 text-center pointer-events-none">
        <p className="text-[9px] tracking-[0.28em] uppercase text-white/38">
          Privacy First / Processed Locally, Never Stored
        </p>
      </footer>
    </div>
  )
}
