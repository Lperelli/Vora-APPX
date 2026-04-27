'use client'

import { useCallback, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { MeasurementBodyWireframe, type MeasurementFocusField } from './measurement-body-wireframe'
import { VoraScreenHeader } from './screen-return-button'
import { VORA_MEASUREMENTS_FORM_MAX } from './vora-layout'

export interface MeasurementsPayload {
  shouldersCm?: number
  bustCm?: number
  waistCm: number
  hipsCm: number
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
  const [shoulders, setShoulders] = useState('')
  const [bust, setBust] = useState('')
  const [waist, setWaist] = useState('')
  const [hips, setHips] = useState('')
  const [focusField, setFocusField] = useState<MeasurementFocusField>(null)

  const shouldersN = toNum(shoulders)
  const bustN = toNum(bust)
  const waistN = toNum(waist)
  const hipsN = toNum(hips)

  const allValid = waistN > 0 && hipsN > 0 && (bustN > 0 || shouldersN > 0)

  const handleShowResults = useCallback(() => {
    if (!allValid) return
    onSubmitMeasurements({
      shouldersCm: shouldersN > 0 ? shouldersN : undefined,
      bustCm: bustN > 0 ? bustN : undefined,
      waistCm: waistN,
      hipsCm: hipsN,
    })
  }, [allValid, shouldersN, bustN, waistN, hipsN, onSubmitMeasurements])

  const fieldShell = useMemo(
    () =>
      'w-full h-[48px] sm:h-[52px] rounded-[14px] border border-white/[0.12] bg-[#141414] px-3.5 text-sm text-foreground outline-none transition-[border-color,background-color,box-shadow] duration-300 ease-out placeholder:text-foreground/22 focus:border-foreground focus:bg-[#161616] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] disabled:opacity-40 sm:px-4',
    []
  )

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background font-sans text-foreground">
      <VoraScreenHeader onReturn={onBack} variant="onTheme" center={<VoraLogo />} />

      {/* Figma: 348px form + 70px gap + wireframe (row); mobile stacks with smaller gap; scrolls on short viewports */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto overscroll-y-contain px-4 pb-[max(5.5rem,env(safe-area-inset-bottom))] pt-4 sm:justify-center sm:px-6 sm:pt-4">
        <div className="flex w-full max-w-full flex-col items-center justify-center gap-10 md:flex-row md:items-start md:justify-center md:gap-[70px]">
          <motion.div
            className={`${VORA_MEASUREMENTS_FORM_MAX} shrink-0 text-center`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="mb-2.5 text-[10px] uppercase tracking-[0.38em] text-foreground/55">Measurements</p>
            <p className="mb-8 px-1 text-[13px] leading-relaxed tracking-[0.01em] text-foreground/42 sm:mb-10">
              Please provide your measurements, madame.
            </p>

            <div className="mx-auto w-full space-y-6 text-left sm:space-y-7">
              <div>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-[11px] tracking-[0.06em] text-foreground/92">Shoulders (cm)</span>
                  <span className="text-[10px] italic tracking-wide text-foreground/38">Optional, if you know it</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={shoulders}
                  onChange={(e) => setShoulders(sanitizeCm(e.target.value))}
                  className={fieldShell}
                  aria-label="Shoulders in centimeters"
                />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-[11px] tracking-[0.06em] text-foreground/92">Bust (cm)</span>
                  <span className="text-[10px] italic tracking-wide text-foreground/38">Optional, but recommended</span>
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
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-[11px] tracking-[0.06em] text-foreground/92">Waist (cm)</span>
                  <span className="text-[10px] italic tracking-wide text-foreground/38">Narrowest part of mid body</span>
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
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-[11px] tracking-[0.06em] text-foreground/92">Hips (cm)</span>
                  <span className="text-[10px] italic tracking-wide text-foreground/38">
                    Widest part of bottom section of body
                  </span>
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

            </div>

            <motion.button
              type="button"
              disabled={!allValid}
              onClick={handleShowResults}
              className="mt-8 h-[48px] w-full rounded-[14px] border border-white/[0.1] bg-[#1a1a1a] px-2 text-[10px] uppercase tracking-[0.18em] text-foreground/92 transition-all duration-300 hover:border-white/[0.14] hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-[0.32] sm:mt-10 sm:h-[52px] sm:text-[11px] sm:tracking-[0.22em]"
              whileHover={!allValid || prefersReducedMotion ? undefined : { scale: 1.01 }}
              whileTap={!allValid || prefersReducedMotion ? undefined : { scale: 0.992 }}
            >
              SHOW ME THE RESULTS
            </motion.button>
          </motion.div>

          <motion.div
            className="flex min-h-[200px] shrink-0 items-start justify-center md:min-h-[280px] md:pt-0"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <MeasurementBodyWireframe
              bust={bustN}
              waist={waistN}
              hips={hipsN}
              focusField={focusField}
            />
          </motion.div>
        </div>
      </div>

      <footer className="pointer-events-none fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/90 to-transparent py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center sm:py-6">
        <p className="px-3 text-[8px] uppercase tracking-[0.24em] text-foreground/38 sm:text-[9px] sm:tracking-[0.28em]">
          Privacy First / Processed Locally, Never Stored
        </p>
      </footer>
    </div>
  )
}
