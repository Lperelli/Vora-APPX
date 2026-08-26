'use client'

import { motion } from 'framer-motion'

export type MeasurementFocusField = 'bust' | 'waist' | 'hips' | null

interface MeasurementBodyWireframeProps {
  bust: number
  waist: number
  hips: number
  focusField: MeasurementFocusField
}

// ── Responsive body geometry (updates as measurements are entered) ─────────
const CX = 70
const Y_TOP = 82
const Y_WAIST = 182
const Y_BOTTOM = 282
const AXIS_TOP = 26
const AXIS_BOTTOM = 338

function halfWidth(value: number, maxValue: number, fallback: number) {
  if (!(value > 0)) return fallback
  const normalized = value / Math.max(maxValue, value)
  return Math.max(12, Math.min(50, 6 + normalized * 44))
}

const lineEase = [0.16, 1, 0.3, 1] as const

export function MeasurementBodyWireframe({ bust, waist, hips, focusField }: MeasurementBodyWireframeProps) {
  const dim = { opacity: 0.25, strokeWidth: 1 }
  const lit = { opacity: 1, strokeWidth: 1.85 }
  const maxValue = Math.max(bust || 0, waist || 0, hips || 0, 1)
  const bustHw = halfWidth(bust, maxValue, 42)
  const waistHw = halfWidth(waist, maxValue, 24)
  const hipsHw = halfWidth(hips, maxValue, 45)

  const bodyPath = [
    `M ${CX - bustHw} ${Y_TOP}`,
    `C ${CX - bustHw} ${Y_TOP + 32}, ${CX - waistHw} ${Y_WAIST - 34}, ${CX - waistHw} ${Y_WAIST}`,
    `C ${CX - waistHw} ${Y_WAIST + 34}, ${CX - hipsHw} ${Y_BOTTOM - 32}, ${CX - hipsHw} ${Y_BOTTOM}`,
    `L ${CX + hipsHw} ${Y_BOTTOM}`,
    `C ${CX + hipsHw} ${Y_BOTTOM - 32}, ${CX + waistHw} ${Y_WAIST + 34}, ${CX + waistHw} ${Y_WAIST}`,
    `C ${CX + waistHw} ${Y_WAIST - 34}, ${CX + bustHw} ${Y_TOP + 32}, ${CX + bustHw} ${Y_TOP}`,
    'Z',
  ].join(' ')

  const indicators: Record<'bust' | 'waist' | 'hips', { y: number; hw: number }> = {
    bust: { y: Y_TOP, hw: bustHw },
    waist: { y: Y_WAIST, hw: waistHw },
    hips: { y: Y_BOTTOM, hw: hipsHw },
  }

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

      {/* The outline morphs to reflect the entered bust, waist and hip ratios. */}
      <motion.path
        initial={false}
        animate={{ d: bodyPath }}
        transition={{ duration: 0.55, ease: lineEase }}
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.1}
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />

      {/* Measurement indicator lines — the focused one lights up (Figma Line 6/7) */}
      {(['bust', 'waist', 'hips'] as const).map((field) => {
        const { y, hw } = indicators[field]
        const active = focusField === field
        return (
          <g key={field}>
            <motion.line
              initial={false}
              animate={{ x1: CX - hw, x2: CX + hw, ...(active ? lit : dim) }}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeLinecap="round"
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
