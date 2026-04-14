'use client'

import { Upload } from 'lucide-react'
import { VoraLogo } from './vora-logo'
import { MotionButton } from '@/components/motion-button'

interface OverwhelmedScreenProps {
  onUploadPhotos: () => void
  onFillQuiz: () => void
}

export function OverwhelmedScreen({ onUploadPhotos, onFillQuiz }: OverwhelmedScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-12 sm:gap-16 px-4 sm:px-6 py-10 sm:py-12">
      <VoraLogo className="text-5xl sm:text-6xl" />

      <div className="text-center space-y-6 max-w-sm">
        <h2 className="text-base tracking-[0.3em] uppercase text-foreground font-medium">
          Overwhelmed?
        </h2>
        <p className="text-sm text-foreground/70 leading-relaxed">
          {"We'll filter the most flattering options for your body type, just give us 3 minutes"}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-xs sm:max-w-none">
        <MotionButton
          onClick={onUploadPhotos}
          className="flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full bg-[oklch(0.16_0_0)] border border-foreground/15 text-foreground text-xs tracking-[0.2em] uppercase py-4 px-7 hover:bg-[oklch(0.20_0_0)] transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Photos
        </MotionButton>
        <span className="hidden sm:inline text-xs tracking-[0.2em] text-muted-foreground uppercase">or</span>
        <MotionButton
          onClick={onFillQuiz}
          className="flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full bg-[oklch(0.16_0_0)] border border-foreground/15 text-foreground text-xs tracking-[0.2em] uppercase py-4 px-7 hover:bg-[oklch(0.20_0_0)] transition-colors"
        >
          Fill Up Quiz
        </MotionButton>
      </div>
    </div>
  )
}
