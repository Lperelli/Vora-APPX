'use client'

import { motion } from 'framer-motion'

export type MeasurementFocusField = 'bust' | 'waist' | 'hips' | null

interface MeasurementBodyWireframeProps {
  // Kept for API compatibility; the silhouette is static like the Figma design.
  bust: number
  waist: number
  hips: number
  focusField: MeasurementFocusField
}

// ── Static hourglass geometry (Figma Quiz_01 — Vector 1 + center axis) ──────
const CX = 70
const Y_TOP = 72
const Y_WAIST = 182
const Y_BOTTOM = 292
const TOP_HW = 44
const WAIST_HW = 7
const BOTTOM_HW = 46
const AXIS_TOP = 26
const AXIS_BOTTOM = 338

// Top trapezoid + bottom trapezoid meeting at a narrow waist = clean hourglass.
const HOURGLASS = [
  `M ${CX - TOP_HW} ${Y_TOP}`,
  `L ${CX + TOP_HW} ${Y_TOP}`,
  `L ${CX + WAIST_HW} ${Y_WAIST}`,
  `L ${CX + BOTTOM_HW} ${Y_BOTTOM}`,
  `L ${CX - BOTTOM_HW} ${Y_BOTTOM}`,
  `L ${CX - WAIST_HW} ${Y_WAIST}`,
  'Z',
].join(' ')

const INDICATORS: Record<'bust' | 'waist' | 'hips', { y: number; hw: number }> = {
  bust: { y: Y_TOP, hw: TOP_HW },
  waist: { y: Y_WAIST, hw: WAIST_HW },
  hips: { y: Y_BOTTOM, hw: BOTTOM_HW },
}

const lineEase = [0.16, 1, 0.3, 1] as const

export function MeasurementBodyWireframe({ focusField }: MeasurementBodyWireframeProps) {
  const dim = { opacity: 0.25, strokeWidth: 1 }
  const lit = { opacity: 1, strokeWidth: 1.85 }

  return (
    <motion.svg
      viewBox="0 0 140 360"
      className="h-auto max-h-[min(48vh,420px)] w-[min(100%,180px)] text-foreground/40 md:w-[170px]"
      aria-hidden
    >
      {/* Vertical center axis (extends beyond the silhouette, like Figma Line 5) */}
      <line
        x1={CX}
        y1={AXIS_TOP}
        x2={CX}
        y2={AXIS_BOTTOM}
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.25}
      />

      {/* Hourglass outline */}
      <path
        d={HOURGLASS}
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.1}
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />

      {/* Measurement indicator lines — the focused one lights up (Figma Line 6/7) */}
      {(['bust', 'waist', 'hips'] as const).map((field) => {
        const { y, hw } = INDICATORS[field]
        const active = focusField === field
        return (
          <g key={field}>
            <motion.line
              x1={CX - hw}
              y1={y}
              x2={CX + hw}
              y2={y}
              stroke="currentColor"
              strokeLinecap="round"
              initial={false}
              animate={active ? lit : dim}
              transition={{ duration: 0.35, ease: lineEase }}
            />
            {active && (
              <g className="text-foreground">
                <circle cx={CX - hw} cy={y} r={3.5} fill="currentColor" />
                <circle cx={CX + hw} cy={y} r={3.5} fill="currentColor" />
              </g>
            )}
          </g>
        )
      })}
    </motion.svg>
  )
}
