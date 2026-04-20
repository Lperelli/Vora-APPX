'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { BodyTypeId } from '@/lib/body-type-analysis'
import type { BodyAnalysis } from '@/app/api/analyze/route'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { VORA_RESULTS_MAX } from './vora-layout'

// ── Line-art silhouettes (one per BodyTypeId from API / presets) ──────────

function HourglassSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="h-full w-full">
      <path
        d="M12 8 Q30 6 48 8 L43 52 Q30 68 30 76 Q30 84 43 100 L48 134 Q30 136 12 134 L17 100 Q30 84 30 76 Q30 68 17 52 Z"
        className="fill-foreground/[0.06] stroke-foreground/65"
      />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/25" />
    </svg>
  )
}

function RectangleSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="h-full w-full">
      <path
        d="M14 8 Q30 6 46 8 L44 68 Q30 72 30 72 Q30 72 16 68 Z M16 76 Q30 72 30 72 Q30 72 44 76 L46 134 Q30 136 14 134 Z"
        className="fill-foreground/[0.06] stroke-foreground/65"
      />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/25" />
    </svg>
  )
}

function PearSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="h-full w-full">
      <path
        d="M18 8 Q30 6 42 8 L40 52 Q30 66 30 76 Q30 86 46 106 L50 134 Q30 138 10 134 L14 106 Q30 86 30 76 Q30 66 20 52 Z"
        className="fill-foreground/[0.06] stroke-foreground/65"
      />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/25" />
    </svg>
  )
}

function AppleSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="h-full w-full">
      <path
        d="M16 8 Q30 6 44 8 L50 62 Q44 86 30 84 Q16 86 10 62 Z M18 88 Q30 84 30 84 Q30 84 42 88 L44 134 Q30 136 16 134 Z"
        className="fill-foreground/[0.06] stroke-foreground/65"
      />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/25" />
    </svg>
  )
}

function InvertedTriangleSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="h-full w-full">
      <path
        d="M8 8 Q30 6 52 8 L46 58 Q30 70 30 80 Q30 70 14 58 Z M20 84 Q30 80 30 80 Q30 80 40 84 L42 134 Q30 136 18 134 Z"
        className="fill-foreground/[0.06] stroke-foreground/65"
      />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/25" />
    </svg>
  )
}

const SILHOUETTES: Record<BodyTypeId, ReactNode> = {
  hourglass: <HourglassSvg />,
  rectangle: <RectangleSvg />,
  pear: <PearSvg />,
  apple: <AppleSvg />,
  'inverted-triangle': <InvertedTriangleSvg />,
}

function silhouetteForBodyType(slug: string) {
  const key = slug.toLowerCase().trim().replace(/_/g, '-') as BodyTypeId
  const valid: BodyTypeId[] = ['hourglass', 'rectangle', 'pear', 'apple', 'inverted-triangle']
  const id = valid.includes(key) ? key : 'rectangle'
  return SILHOUETTES[id]
}

const FALLBACK_CELEB_IMAGES = [
  '/celebrities/celebrity-1.jpg',
  '/celebrities/celebrity-2.jpg',
  '/celebrities/celebrity-3.jpg',
  '/celebrities/celebrity-4.jpg',
]

interface ResultsScreenProps {
  analysis: BodyAnalysis
  onRedo: () => void
}

/**
 * Figma-aligned results (Frame 98, 545px): silhouette card → what works for you → celebrity
 * references with per-card 3D Y flip revealed in sequence when the block scrolls into view.
 */
export function ResultsScreen({ analysis, onRedo }: ResultsScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const silhouette = silhouetteForBodyType(analysis.bodyType)
  const label = analysis.bodyTypeLabel

  const handleEmail = () => {
    const subject = encodeURIComponent(`My VORA Style Profile — ${label}`)
    const body = encodeURIComponent(
      `My body type: ${label}\n\n${analysis.silhouetteDescription}\n\nWhat works for me:\n${analysis.whatWorksForYou
        .map((t) => `• ${t}`)
        .join('\n')}`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <motion.div
      className="flex min-h-[100dvh] flex-col items-stretch bg-background px-4 pb-28 pt-0 sm:px-6"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-4 sm:mb-6"
      >
        <VoraScreenHeader onReturn={onRedo} variant="onTheme" center={<VoraLogo />} />
      </motion.div>

      {/* ── Intro copy ─────────────────────────────────────────── */}
      <motion.div
        className={`${VORA_RESULTS_MAX} mb-6 space-y-2 text-center`}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
      >
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/85">Ta-da! Your body type</p>
        <p className="text-[13px] leading-relaxed text-foreground/55">
          {analysis.analysisSource === 'measurement'
            ? "We've analyzed your measurements. Here's what we discovered."
            : "We've analyzed your measurements and photo. Here's what we discovered."}
        </p>
      </motion.div>

      {/* ── Stacked cards (545px column) ───────────────────────── */}
      <div className={`${VORA_RESULTS_MAX} flex flex-col gap-[18px]`}>
        {/* ① Silhouette */}
        <motion.section
          className="rounded-2xl border border-white/[0.06] bg-[oklch(0.12_0_0)] p-6 sm:p-7"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(12px)' }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.14 }}
        >
          <div className="flex items-center gap-6 sm:gap-8">
            <div className="h-[190px] w-[78px] shrink-0 sm:h-[210px] sm:w-[86px]">{silhouette}</div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[9.5px] uppercase tracking-[0.28em] text-foreground/50">Your silhouette</p>
              <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-foreground">{label}</p>
              <p className="text-[12.5px] leading-[1.6] text-foreground/60">
                {analysis.silhouetteDescription}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ② What works for you */}
        <motion.section
          className="rounded-2xl border border-white/[0.06] bg-[oklch(0.12_0_0)] p-6 sm:p-7"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(12px)' }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
        >
          <p className="mb-4 text-[9.5px] uppercase tracking-[0.28em] text-foreground/50">What works for you</p>
          <ul className="space-y-3">
            {analysis.whatWorksForYou.map((tip, i) => (
              <motion.li
                key={i}
                className="flex items-start gap-3"
                initial={prefersReducedMotion ? false : { opacity: 0, x: -4 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 + i * 0.05 }}
              >
                <Check className="mt-[2px] h-3.5 w-3.5 shrink-0 text-foreground/70" strokeWidth={2.25} />
                <span className="text-[13px] leading-[1.55] text-foreground/78">{tip}</span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* ③ Celebrity references (per-card 3D flip) */}
        <CelebrityReferences
          bodyTypeLabel={label}
          celebrities={analysis.celebrities ?? []}
          prefersReducedMotion={!!prefersReducedMotion}
        />

        {/* ④ Unveil CTA */}
        <motion.button
          type="button"
          onClick={handleEmail}
          className="mx-auto mt-2 flex items-center justify-center gap-2.5 rounded-full border border-white/12 bg-[oklch(0.14_0_0)] px-7 py-3.5 text-[11px] uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-[oklch(0.18_0_0)]"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
          Unveil style recommendations for you
        </motion.button>
      </div>

      {/* ── Sticky REDO / E-MAIL ───────────────────────────────── */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-background/95 px-4 pt-4 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      >
        <div className={`flex gap-3 sm:gap-4 ${VORA_RESULTS_MAX}`}>
          <motion.button
            type="button"
            onClick={onRedo}
            className="flex-1 rounded-full border border-foreground/20 bg-transparent py-3.5 text-xs uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-foreground/5"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            Redo
          </motion.button>
          <motion.button
            type="button"
            onClick={handleEmail}
            className="flex-1 rounded-full bg-foreground py-3.5 text-xs uppercase tracking-[0.22em] text-background transition-colors hover:bg-foreground/90"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            E-Mail Results
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Celebrity references (flip cards) ─────────────────────────────────────

type Celebrity = NonNullable<BodyAnalysis['celebrities']>[number]

const FLIP_STAGGER_MS = 260
const FLIP_MS = 700

function CelebrityReferences({
  bodyTypeLabel,
  celebrities,
  prefersReducedMotion,
}: {
  bodyTypeLabel: string
  celebrities: Celebrity[]
  prefersReducedMotion: boolean
}) {
  const items = celebrities.slice(0, 4)
  const count = items.length

  const [flippedCount, setFlippedCount] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (triggeredRef.current || count === 0) return
    if (prefersReducedMotion) {
      setFlippedCount(count)
      triggeredRef.current = true
      return
    }

    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      triggeredRef.current = true
      const timers: number[] = []
      for (let i = 0; i < count; i++) {
        timers.push(
          window.setTimeout(() => setFlippedCount((c) => Math.max(c, i + 1)), 600 + i * FLIP_STAGGER_MS)
        )
      }
      return () => timers.forEach((t) => window.clearTimeout(t))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !triggeredRef.current) {
            triggeredRef.current = true
            for (let i = 0; i < count; i++) {
              window.setTimeout(
                () => setFlippedCount((c) => Math.max(c, i + 1)),
                280 + i * FLIP_STAGGER_MS
              )
            }
            observer.disconnect()
          }
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [count, prefersReducedMotion])

  if (count === 0) return null

  const revealAll = () => {
    if (flippedCount >= count) return
    triggeredRef.current = true
    for (let i = 0; i < count; i++) {
      window.setTimeout(() => setFlippedCount((c) => Math.max(c, i + 1)), i * 120)
    }
  }

  return (
    <motion.section
      ref={sectionRef}
      className="rounded-2xl border border-white/[0.06] bg-[oklch(0.12_0_0)] p-6 sm:p-7"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(12px)' }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.32 }}
      onClick={revealAll}
    >
      <div className="mb-5 space-y-1 text-center">
        <p className="text-[9.5px] uppercase tracking-[0.3em] text-foreground/55">
          See {bodyTypeLabel} References
        </p>
        <p className="text-[12.5px] leading-relaxed text-foreground/55">
          Reveal celebrities with the same body type as yours.
        </p>
        <p className="text-[12.5px] italic text-foreground/45">Get inspired</p>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {items.map((celeb, i) => (
          <CelebrityFlipCard
            key={`${celeb.name}-${i}`}
            index={i}
            name={celeb.name}
            imageSrc={celeb.imageSrc || FALLBACK_CELEB_IMAGES[i % FALLBACK_CELEB_IMAGES.length]}
            flipped={i < flippedCount}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>
    </motion.section>
  )
}

function CelebrityFlipCard({
  index,
  name,
  imageSrc,
  flipped,
  prefersReducedMotion,
}: {
  index: number
  name: string
  imageSrc: string
  flipped: boolean
  prefersReducedMotion: boolean
}) {
  if (prefersReducedMotion) {
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
        <Image
          src={imageSrc}
          alt={name}
          fill
          className="object-cover object-top"
          sizes="(max-width:640px) 24vw, 120px"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-1.5 pt-6">
          <p className="text-center text-[8.5px] font-medium uppercase tracking-[0.12em] leading-[1.15] text-white">
            {name}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="aspect-[3/4] w-full min-w-0 [perspective:900px]">
      <div
        className="relative h-full w-full origin-center transition-transform [transform-style:preserve-3d]"
        style={{
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transitionDuration: `${FLIP_MS}ms`,
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* FRONT — dashed BODY N placeholder */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl border border-dashed border-white/30 bg-[oklch(0.11_0_0)]"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
            pointerEvents: flipped ? 'none' : 'auto',
          }}
        >
          <span className="text-[9px] font-medium tracking-[0.22em] uppercase text-foreground/55">
            Body {index + 1}
          </span>
        </div>

        {/* BACK — celebrity portrait */}
        <div
          className="absolute inset-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10 shadow-[0_14px_40px_-18px_rgba(0,0,0,0.75)]"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            pointerEvents: flipped ? 'auto' : 'none',
          }}
        >
          <Image
            src={imageSrc}
            alt={name}
            fill
            className="object-cover object-top"
            sizes="(max-width:640px) 24vw, 120px"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-1.5 pt-8">
            <p className="text-center text-[8.5px] font-medium uppercase tracking-[0.12em] leading-[1.15] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              {name}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
