'use client'

import { Clock, Upload } from 'lucide-react'
import { VoraLogo } from './vora-logo'

interface IntroScreenProps {
  onUploadPhotos: () => void
  onEnterMeasurements: () => void
}

export function IntroScreen({ onUploadPhotos, onEnterMeasurements }: IntroScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between py-12 px-6">
      <VoraLogo />

      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md w-full gap-10">
        <div className="space-y-5">
          <h2 className="text-xl font-semibold tracking-[0.12em] uppercase text-foreground">
            We know online fitting is a struggle.
          </h2>
          <p className="text-sm text-foreground/70 leading-relaxed">
            {"That's why we make the science of styling available to everyone. Try VORA and get personalized outfits that will flatter you the most according to your body type."}
          </p>
          <div className="flex items-center justify-center gap-2 text-foreground/60">
            <Clock className="w-4 h-4" />
            <span className="text-sm">3 min</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={onUploadPhotos}
            className="flex items-center justify-center gap-3 w-full rounded-full border border-foreground/20 bg-[oklch(0.14_0_0)] text-foreground text-xs tracking-[0.2em] uppercase py-4 px-6 hover:bg-[oklch(0.18_0_0)] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Photos
          </button>
          <p className="text-xs text-muted-foreground text-center tracking-widest uppercase">or</p>
          <button
            onClick={onEnterMeasurements}
            className="flex items-center justify-center gap-3 w-full rounded-full border border-foreground/20 bg-[oklch(0.14_0_0)] text-foreground text-xs tracking-[0.2em] uppercase py-4 px-6 hover:bg-[oklch(0.18_0_0)] transition-colors"
          >
            Enter Measurements
          </button>
        </div>
      </div>

      <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
        Privacy First / Processed Locally, Never Stored
      </p>
    </div>
  )
}
