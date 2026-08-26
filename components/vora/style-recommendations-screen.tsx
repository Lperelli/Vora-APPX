'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import type { BodyAnalysis } from '@/lib/body-type-analysis'
import { BODY_TYPE_ARTICLES } from '@/lib/body-type-articles'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { VORA_RECOMMENDATIONS_MAX, VORA_RESULTS_MAX } from './vora-layout'
import { asset } from '@/lib/base-path'

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
  const relatedArticle = BODY_TYPE_ARTICLES[analysis.bodyType]

  const dateLabel = useMemo(() => {
    return new Date()
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      .toUpperCase()
  }, [])

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
      <div className={`${VORA_RECOMMENDATIONS_MAX} grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7`}>
        {products.map((product, i) => (
          <motion.article
            key={`${product.brand}-${product.name}`}
            className="flex min-w-0 flex-col border border-white/[0.07] bg-[oklch(0.12_0_0)]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16, filter: 'blur(10px)' }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.04 * i }}
          >
            <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-black">
              <Image
                src={asset(product.image)}
                alt={product.name}
                fill
                className="object-cover object-center"
                sizes="(max-width:767px) 94vw, 440px"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 sm:p-6">
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[0.26em] text-foreground/45">{product.brand}</p>
                <p className="text-[12px] uppercase tracking-[0.12em] text-foreground/90 sm:text-[12.5px]">
                  {product.name}
                </p>
                <p className="text-[12px] text-foreground/55">{product.price}</p>
              </div>

              {product.shopUrl ? (
                <a
                  href={product.shopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-fit items-center justify-center rounded-full border border-white/12 bg-[oklch(0.16_0_0)] px-6 text-[9px] uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-[oklch(0.22_0_0)]"
                >
                  Shop
                </a>
              ) : (
                <span className="inline-flex h-10 w-fit items-center justify-center rounded-full border border-white/[0.07] px-6 text-[9px] uppercase tracking-[0.2em] text-foreground/32">
                  Link coming soon
                </span>
              )}

              <p className="max-w-[260px] text-[11.5px] italic leading-relaxed text-foreground/50">
                {product.stylingNote}
              </p>
            </div>
          </motion.article>
        ))}
      </div>

      {relatedArticle && (
        <motion.section
          className={`${VORA_RECOMMENDATIONS_MAX} mt-14 border-t border-white/[0.09] pt-10 sm:mt-20 sm:pt-12`}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18, filter: 'blur(10px)' }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.22 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-5 flex items-end justify-between gap-5">
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-foreground/42">Keep exploring</p>
              <h2 className="mt-2 text-[12px] uppercase tracking-[0.19em] text-foreground sm:text-[13px]">
                Your styling journal
              </h2>
            </div>
            <span className="hidden text-[9px] uppercase tracking-[0.24em] text-foreground/35 sm:block">
              Selected for {label}
            </span>
          </div>

          <a
            href={relatedArticle.url}
            target="_top"
            className="group grid overflow-hidden border border-white/[0.08] bg-[oklch(0.12_0_0)] sm:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]"
          >
            <div className="relative aspect-square min-h-0 overflow-hidden bg-black sm:aspect-auto sm:min-h-[360px]">
              <Image
                src={relatedArticle.image}
                alt=""
                fill
                unoptimized
                className="object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
                sizes="(max-width:639px) 94vw, 560px"
              />
            </div>
            <div className="flex flex-col justify-between gap-10 p-6 sm:p-8">
              <div>
                <p className="text-[9px] uppercase tracking-[0.26em] text-foreground/42">For your body type</p>
                <h3 className="mt-4 font-serif text-[26px] leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[31px]">
                  {relatedArticle.title}
                </h3>
                <p className="mt-5 text-[12px] leading-[1.7] text-foreground/52 sm:text-[13px]">
                  {relatedArticle.summary}
                </p>
              </div>
              <span className="flex items-center gap-2 text-[9px] uppercase tracking-[0.24em] text-foreground/75">
                Read article
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </div>
          </a>
        </motion.section>
      )}

      {/* ── Sticky REDO ────────────────────────────────────────── */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-background/95 px-4 pt-4 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <div className={`flex ${VORA_RESULTS_MAX}`}>
          <motion.button
            type="button"
            onClick={onRedo}
            className="w-full rounded-full border border-foreground/20 bg-transparent py-3.5 text-xs uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-foreground/5"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            Redo
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
