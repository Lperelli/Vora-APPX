'use client'

import Image from 'next/image'
import { VoraLogo } from './vora-logo'
import { MotionButton } from '@/components/motion-button'

interface WelcomeScreenProps {
  onStart: () => void
  onSkip: () => void
}

const portraits = [
  { src: '/portraits/woman-1.jpg', alt: 'Fashion portrait' },
  { src: '/portraits/woman-2.jpg', alt: 'Fashion portrait' },
  { src: '/portraits/woman-3.jpg', alt: 'Fashion portrait' },
  { src: '/portraits/woman-4.jpg', alt: 'Fashion portrait' },
  { src: '/portraits/woman-5.jpg', alt: 'Fashion portrait' },
  { src: '/portraits/woman-6.jpg', alt: 'Fashion portrait' },
]

export function WelcomeScreen({ onStart, onSkip }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-6 max-w-6xl w-full mx-auto">
        <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Return</span>
        <VoraLogo />
        <span className="w-16" />
      </header>

      {/* Photo grid with overlay card */}
      <div className="relative flex-1 mx-4 sm:mx-8 mb-4 overflow-hidden rounded-2xl max-w-6xl w-full self-center">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5 h-full min-h-[420px] sm:min-h-[520px]">
          {portraits.map((p, i) => (
            <div key={i} className="relative overflow-hidden">
              <Image
                src={p.src}
                alt={p.alt}
                fill
                className="object-cover object-top"
                sizes="(max-width: 768px) 33vw, 25vw"
              />
            </div>
          ))}
        </div>

        {/* Overlay card */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-[oklch(0.12_0_0/0.92)] backdrop-blur-sm rounded-2xl px-6 sm:px-10 py-8 mx-4 max-w-sm w-full text-center border border-border/30">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase mb-2">Overwhelmed?</p>
            <p className="text-sm text-foreground/80 leading-relaxed mb-8">
              {"We'll filter the most flattering options for your body type, just give us 3 minutes"}
            </p>
            <div className="flex flex-col gap-3">
              <MotionButton
                onClick={onStart}
                className="w-full rounded-full border border-foreground/30 bg-transparent text-foreground text-xs tracking-[0.25em] uppercase py-3.5 px-6 hover:bg-foreground/10 transition-colors"
              >
                Start
              </MotionButton>
              <MotionButton
                onClick={onSkip}
                className="w-full rounded-full border border-foreground/10 bg-transparent text-foreground/50 text-xs tracking-[0.25em] uppercase py-3.5 px-6 hover:bg-foreground/5 transition-colors"
              >
                Not Now
              </MotionButton>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy footer */}
      <footer className="text-center py-6">
        <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
          Privacy First / Processed Locally, Never Stored
        </p>
      </footer>
    </div>
  )
}
