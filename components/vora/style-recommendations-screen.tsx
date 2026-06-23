'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { BodyAnalysis } from '@/lib/body-type-analysis'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { VORA_RESULTS_MAX } from './vora-layout'

interface StyleRecommendationsScreenProps {
  analysis: BodyAnalysis
  onBack: () => void
  onRedo: () => void
}

/**
 * Figma 327:423 — editorial "Your top 5 must haves" page reached from the
 * "Unveil style recommendations" CTA. Curated product cards per body type.
 */
export function StyleRecommendationsScreen({ analysis, onBack, onRedo }: StyleRecommendationsScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const label = analysis.bodyTypeLabel
  const products = analysis.styleProducts ?? []

  const dateLabel = useMemo(() => {
    return new Date()
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      .toUpperCase()
  }, [])

  const handleEmail = () => {
    const subject = encodeURIComponent(`My VORA Top 5 — ${label} Chic`)
    const body = encodeURIComponent(
      `My top 5 must-haves as a ${label} chic:\n\n${products
        .map((p) => `• ${p.brand} — ${p.name} (${p.price})`)
        .join('\n')}`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <motion.div
      className="flex min-h-[100dvh] flex-col items-stretch overflow-x-hidden bg-background px-3 pb-32 pt-0 sm:px-6 sm:pb-28"
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
        <VoraScreenHeader onReturn={onBack} variant="onTheme" center={<VoraLogo />} />
      </motion.div>

      {/* ── Editorial header ───────────────────────────────────── */}
      <motion.header
        className={`${VORA_RESULTS_MAX} mb-8 text-center sm:mb-10`}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
      >
        <h1 className="text-[12px] uppercase leading-relaxed tracking-[0.22em] text-foreground sm:text-[13px]">
          Your top 5 must haves as a {label} chic
        </h1>
        <p className="mt-3 text-[9px] uppercase tracking-[0.3em] text-foreground/40">{dateLabel}</p>
        <p className="mx-auto mt-6 max-w-[460px] text-[12.5px] leading-[1.7] text-foreground/60 sm:text-[13px]">
          {analysis.styleIntro}
        </p>
      </motion.header>

      {/* ── Product list ───────────────────────────────────────── */}
      <div className={`${VORA_RESULTS_MAX} flex flex-col gap-5 sm:gap-6`}>
        {products.map((product, i) => (
          <motion.article
            key={`${product.brand}-${product.name}`}
            className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-[oklch(0.12_0_0)] p-4 sm:flex-row sm:items-stretch sm:gap-6 sm:p-5"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16, filter: 'blur(10px)' }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.04 * i }}
          >
            <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10 sm:h-[230px] sm:w-[160px]">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover object-top"
                sizes="(max-width:640px) 90vw, 160px"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 sm:py-1">
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[0.26em] text-foreground/45">{product.brand}</p>
                <p className="text-[12px] uppercase tracking-[0.12em] text-foreground/90 sm:text-[12.5px]">
                  {product.name}
                </p>
                <p className="text-[12px] text-foreground/55">{product.price}</p>
              </div>

              <a
                href={product.shopUrl ?? '#'}
                target={product.shopUrl ? '_blank' : undefined}
                rel={product.shopUrl ? 'noopener noreferrer' : undefined}
                className="inline-flex h-9 w-fit items-center justify-center rounded-full border border-white/12 bg-[oklch(0.16_0_0)] px-6 text-[9px] uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-[oklch(0.22_0_0)]"
              >
                Shop
              </a>

              <p className="max-w-[260px] text-[11.5px] italic leading-relaxed text-foreground/50">
                {product.stylingNote}
              </p>
            </div>
          </motion.article>
        ))}
      </div>

      {/* ── Sticky REDO / E-MAIL ───────────────────────────────── */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-background/95 px-4 pt-4 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
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
