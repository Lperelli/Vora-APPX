'use client'

import Image from 'next/image'
import { Check, X } from 'lucide-react'
import { VoraLogo } from './vora-logo'
import type { BodyAnalysis } from '@/app/api/analyze/route'

// ── Silhouette SVG illustrations ───────────────────────────────────────
function HourglassSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 8 Q30 6 48 8 L43 52 Q30 68 30 76 Q30 84 43 100 L48 134 Q30 136 12 134 L17 100 Q30 84 30 76 Q30 68 17 52 Z" className="fill-foreground/10 stroke-foreground/60" />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/20" />
    </svg>
  )
}

function RectangleSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="w-full h-full">
      <path d="M14 8 Q30 6 46 8 L44 68 Q30 72 30 72 Q30 72 16 68 Z M16 76 Q30 72 30 72 Q30 72 44 76 L46 134 Q30 136 14 134 Z" className="fill-foreground/10 stroke-foreground/60" />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/20" />
    </svg>
  )
}

function PearSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="w-full h-full">
      <path d="M18 8 Q30 6 42 8 L40 52 Q30 66 30 76 Q30 86 46 106 L50 134 Q30 138 10 134 L14 106 Q30 86 30 76 Q30 66 20 52 Z" className="fill-foreground/10 stroke-foreground/60" />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/20" />
    </svg>
  )
}

function AppleSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="w-full h-full">
      <path d="M16 8 Q30 6 44 8 L50 62 Q44 86 30 84 Q16 86 10 62 Z M18 88 Q30 84 30 84 Q30 84 42 88 L44 134 Q30 136 16 134 Z" className="fill-foreground/10 stroke-foreground/60" />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/20" />
    </svg>
  )
}

function InvertedTriangleSvg() {
  return (
    <svg viewBox="0 0 60 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="w-full h-full">
      <path d="M8 8 Q30 6 52 8 L46 58 Q30 70 30 80 Q30 70 14 58 Z M20 84 Q30 80 30 80 Q30 80 40 84 L42 134 Q30 136 18 134 Z" className="fill-foreground/10 stroke-foreground/60" />
      <line x1="30" y1="4" x2="30" y2="138" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" className="text-foreground/20" />
    </svg>
  )
}

const SILHOUETTES: Record<string, React.ReactNode> = {
  hourglass: <HourglassSvg />,
  rectangle: <RectangleSvg />,
  pear: <PearSvg />,
  apple: <AppleSvg />,
  'inverted-triangle': <InvertedTriangleSvg />,
}

const CELEBRITY_IMAGES = [
  '/celebrities/celebrity-1.jpg',
  '/celebrities/celebrity-2.jpg',
  '/celebrities/celebrity-3.jpg',
  '/celebrities/celebrity-4.jpg',
]

interface ResultsScreenProps {
  analysis: BodyAnalysis
  onRedo: () => void
}

export function ResultsScreen({ analysis, onRedo }: ResultsScreenProps) {
  const silhouette = SILHOUETTES[analysis.bodyType] ?? SILHOUETTES['rectangle']

  const handleEmail = () => {
    const subject = encodeURIComponent(`My VORA Style Profile — ${analysis.bodyTypeLabel}`)
    const body = encodeURIComponent(
      `My body type: ${analysis.bodyTypeLabel}\n\n${analysis.silhouetteDescription}\n\nWhat works for me:\n${analysis.whatWorksForYou.map((t) => `• ${t}`).join('\n')}`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 pb-28">
      {/* Header */}
      <header className="w-full flex items-center justify-center mb-10">
        <VoraLogo />
      </header>

      {/* Labels */}
      <div className="text-center mb-6 space-y-1">
        <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
          Ta-da! Your Body Type
        </p>
        <p className="text-xs text-foreground/45 leading-relaxed">
          {"We've analyzed your measurements and photo. Here's what we discovered."}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">

        {/* ── Silhouette card ── */}
        <div className="rounded-2xl bg-[oklch(0.12_0_0)] border border-white/5 p-5 flex gap-5">
          <div className="w-14 h-36 shrink-0 text-foreground/70 mt-1">
            {silhouette}
          </div>
          <div className="flex flex-col justify-center gap-2.5 min-w-0">
            <div>
              <p className="text-[9px] tracking-[0.28em] text-muted-foreground uppercase mb-0.5">
                Your Silhouette
              </p>
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-foreground">
                {analysis.bodyTypeLabel}
              </p>
            </div>
            <p className="text-xs text-foreground/60 leading-relaxed">
              {analysis.silhouetteDescription}
            </p>
          </div>
        </div>

        {/* ── What works for you ── */}
        <div className="rounded-2xl bg-[oklch(0.12_0_0)] border border-white/5 p-5 space-y-3">
          <p className="text-[9px] tracking-[0.28em] text-muted-foreground uppercase">
            What Works For You
          </p>
          <ul className="space-y-2.5">
            {analysis.whatWorksForYou.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check className="w-3 h-3 mt-0.5 shrink-0 text-foreground/50" />
                <span className="text-xs text-foreground/75 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── What to avoid ── */}
        {analysis.whatToAvoid?.length > 0 && (
          <div className="rounded-2xl bg-[oklch(0.12_0_0)] border border-white/5 p-5 space-y-3">
            <p className="text-[9px] tracking-[0.28em] text-muted-foreground uppercase">
              What to Avoid
            </p>
            <ul className="space-y-2.5">
              {analysis.whatToAvoid.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <X className="w-3 h-3 mt-0.5 shrink-0 text-foreground/30" />
                  <span className="text-xs text-foreground/65 leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Style tips ── */}
        {analysis.styleRecommendations?.length > 0 && (
          <div className="rounded-2xl bg-[oklch(0.12_0_0)] border border-white/5 p-5 space-y-3">
            <p className="text-[9px] tracking-[0.28em] text-muted-foreground uppercase">
              Style Tips
            </p>
            <ul className="space-y-3">
              {analysis.styleRecommendations.map((rec, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="text-[9px] tracking-[0.2em] uppercase text-foreground/35 shrink-0 mt-0.5 w-14">
                    {rec.category}
                  </span>
                  <span className="text-xs text-foreground/70 leading-relaxed">{rec.tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Celebrity references ── */}
        {analysis.celebrities?.length > 0 && (
          <div className="rounded-2xl bg-[oklch(0.12_0_0)] border border-white/5 p-5 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-[9px] tracking-[0.28em] text-muted-foreground uppercase">
                See {analysis.bodyTypeLabel} References
              </p>
              <p className="text-xs text-foreground/45">
                Celebrities with the same body type as yours. Get inspired
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {analysis.celebrities.slice(0, 4).map((celeb, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-[3/4]">
                  <Image
                    src={CELEBRITY_IMAGES[i % CELEBRITY_IMAGES.length]}
                    alt={celeb.name}
                    fill
                    className="object-cover object-top"
                    sizes="80px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 text-center">
                    <p className="text-[7.5px] tracking-[0.08em] text-white uppercase leading-tight font-medium">
                      {celeb.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Unveil style CTA (in-page) ── */}
        <button
          className="w-full flex items-center justify-center gap-2.5 rounded-full bg-[oklch(0.16_0_0)] border border-white/10 text-foreground text-xs tracking-[0.2em] uppercase py-4 hover:bg-[oklch(0.20_0_0)] transition-colors"
          onClick={handleEmail}
        >
          <span className="w-2 h-2 rounded-full bg-green-400" />
          Unveil Style Recommendations For You
        </button>
      </div>

      {/* ── Sticky bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-white/5 px-4 py-4 z-50">
        <div className="flex gap-3 max-w-sm mx-auto">
          <button
            onClick={onRedo}
            className="flex-1 rounded-full border border-foreground/20 bg-transparent text-foreground text-xs tracking-[0.2em] uppercase py-3.5 hover:bg-foreground/5 transition-colors"
          >
            Redo
          </button>
          <button
            onClick={handleEmail}
            className="flex-1 rounded-full bg-foreground text-background text-xs tracking-[0.2em] uppercase py-3.5 hover:bg-foreground/90 transition-colors"
          >
            E-Mail Results
          </button>
        </div>
      </div>
    </div>
  )
}
