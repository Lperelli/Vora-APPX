'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'

export type MeasurementFocusField = 'bust' | 'waist' | 'hips' | 'height' | null

type Geom = {
  hb: number
  hw: number
  hh: number
  yTop: number
  yBust: number
  yWaist: number
  yHip: number
  yBottom: number
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

function computeGeom(bust: number, waist: number, hips: number, height: number): Geom {
  const h = Math.max(height, 120)
  const spanBase = 220
  const hNorm = clamp(h / 172, 0.82, 1.28)
  const yTop = 24
  const yBottom = yTop + spanBase * hNorm
  const span = yBottom - yTop

  const hb = clamp((bust / h) * 88, 20, 54)
  const hw = clamp((waist / h) * 76, 12, 46)
  const hh = clamp((hips / h) * 84, 16, 58)

  return {
    hb,
    hw,
    hh,
    yTop,
    yBust: yTop + span * 0.2,
    yWaist: yTop + span * 0.45,
    yHip: yTop + span * 0.7,
    yBottom,
  }
}

function outlinePath(g: Geom, cx: number): string {
  const yB = g.yBust
  const yW = g.yWaist
  const yH = g.yHip
  const yBot = g.yBottom - 10
  const { hb, hw, hh } = g
  return [
    `M ${cx - hb} ${yB}`,
    `L ${cx + hb} ${yB}`,
    `L ${cx + hw} ${yW}`,
    `L ${cx + hh} ${yH}`,
    `L ${cx} ${yBot}`,
    `L ${cx - hh} ${yH}`,
    `L ${cx - hw} ${yW}`,
    'Z',
  ].join(' ')
}

interface MeasurementBodyWireframeProps {
  bust: number
  waist: number
  hips: number
  height: number
  focusField: MeasurementFocusField
}

const CX = 70

const lineEase = [0.16, 1, 0.3, 1] as const

export function MeasurementBodyWireframe({
  bust,
  waist,
  hips,
  height,
  focusField,
}: MeasurementBodyWireframeProps) {
  const b = bust > 0 ? bust : 92
  const w = waist > 0 ? waist : 70
  const h = hips > 0 ? hips : 98
  const ht = height > 0 ? height : 168
  const g = useMemo(() => computeGeom(b, w, h, ht), [b, w, h, ht])
  const d = outlinePath(g, CX)
  const { hb, hw, hh, yBust, yWaist, yHip, yTop, yBottom } = g

  const dim = { opacity: 0.22, strokeWidth: 1 as number }
  const lit = { opacity: 1, strokeWidth: 1.85 as number }

  return (
    <motion.svg
      viewBox="0 0 140 300"
      className="h-auto max-h-[min(52vh,420px)] w-[min(100%,200px)] text-foreground/35 md:w-[min(100%,240px)]"
      aria-hidden
    >
      <motion.line
        x1={CX}
        y1={yTop}
        x2={CX}
        y2={yBottom}
        stroke="currentColor"
        strokeLinecap="round"
        animate={
          focusField === 'height' ? { opacity: 1, strokeWidth: 1.6 } : { opacity: 0.35, strokeWidth: 1 }
        }
        transition={{ duration: 0.35, ease: lineEase }}
      />
      <motion.circle
        cx={CX}
        cy={yTop}
        r={2.2}
        fill="currentColor"
        animate={{ opacity: focusField === 'height' ? 1 : 0.35 }}
        transition={{ duration: 0.35, ease: lineEase }}
      />
      <motion.circle
        cx={CX}
        cy={yBottom}
        r={2.2}
        fill="currentColor"
        animate={{ opacity: focusField === 'height' ? 1 : 0.35 }}
        transition={{ duration: 0.35, ease: lineEase }}
      />

      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={false}
        animate={{ d }}
        transition={{ duration: 0.5, ease: lineEase }}
        style={{ strokeWidth: 1.1 }}
      />

      <motion.line
        x1={CX - hb}
        y1={yBust}
        x2={CX + hb}
        y2={yBust}
        stroke="currentColor"
        strokeLinecap="round"
        initial={false}
        animate={focusField === 'bust' ? lit : dim}
        transition={{ duration: 0.35, ease: lineEase }}
      />
      <motion.line
        x1={CX - hw}
        y1={yWaist}
        x2={CX + hw}
        y2={yWaist}
        stroke="currentColor"
        strokeLinecap="round"
        initial={false}
        animate={focusField === 'waist' ? lit : dim}
        transition={{ duration: 0.35, ease: lineEase }}
      />
      <motion.line
        x1={CX - hh}
        y1={yHip}
        x2={CX + hh}
        y2={yHip}
        stroke="currentColor"
        strokeLinecap="round"
        initial={false}
        animate={focusField === 'hips' ? lit : dim}
        transition={{ duration: 0.35, ease: lineEase }}
      />

      {focusField === 'bust' && (
        <g className="text-foreground">
          <circle cx={CX - hb} cy={yBust} r={3.5} fill="currentColor" />
          <circle cx={CX + hb} cy={yBust} r={3.5} fill="currentColor" />
        </g>
      )}
      {focusField === 'waist' && (
        <g className="text-foreground">
          <circle cx={CX - hw} cy={yWaist} r={3.5} fill="currentColor" />
          <circle cx={CX + hw} cy={yWaist} r={3.5} fill="currentColor" />
        </g>
      )}
      {focusField === 'hips' && (
        <g className="text-foreground">
          <circle cx={CX - hh} cy={yHip} r={3.5} fill="currentColor" />
          <circle cx={CX + hh} cy={yHip} r={3.5} fill="currentColor" />
        </g>
      )}
    </motion.svg>
  )
}
