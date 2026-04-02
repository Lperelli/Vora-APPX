'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { X, Plus, Download } from 'lucide-react'
import { VoraLogo } from './vora-logo'

interface PhotoUploadScreenProps {
  onSubmit: (files: File[]) => void
  onBack: () => void
}

interface PhotoSlot {
  file: File
  preview: string
}

export function PhotoUploadScreen({ onSubmit, onBack }: PhotoUploadScreenProps) {
  const [photos, setPhotos] = useState<PhotoSlot[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remaining = 3 - photos.length
    const toAdd = files.slice(0, remaining)

    const newSlots: PhotoSlot[] = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))

    setPhotos((prev) => [...prev, ...newSlots])
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  const handleSubmit = () => {
    if (photos.length === 0) return
    onSubmit(photos.map((p) => p.file))
  }

  // Always show 3 slots (filled + empty up to 3)
  const slots = [0, 1, 2]

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-6">
      {/* Header */}
      <header className="w-full flex items-center justify-center mb-12">
        <VoraLogo />
      </header>

      {/* Photo slots */}
      <div className="flex gap-3 mb-14 w-full max-w-xl justify-center flex-wrap">
        {slots.map((i) => {
          const photo = photos[i]
          if (photo) {
            return (
              <div
                key={i}
                className="relative w-[150px] h-[200px] md:w-[170px] md:h-[220px] rounded-2xl overflow-hidden bg-[oklch(0.14_0_0)] shrink-0"
              >
                <Image
                  src={photo.preview}
                  alt={`Photo ${i + 1}`}
                  fill
                  className="object-cover object-top"
                />
                {/* Remove button */}
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 flex items-center justify-center hover:bg-background transition-colors z-10"
                  aria-label="Remove photo"
                >
                  <X className="w-3.5 h-3.5 text-foreground" />
                </button>
                {/* Download icon */}
                <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-background/30 flex items-center justify-center">
                  <Download className="w-3 h-3 text-foreground/70" />
                </div>
              </div>
            )
          }

          // Empty slot — only show the 4th as "selfie" placeholder style
          const isLastActive = i === photos.length
          return (
            <button
              key={i}
              onClick={() => isLastActive && fileInputRef.current?.click()}
              className={`relative w-[150px] h-[200px] md:w-[170px] md:h-[220px] rounded-2xl border border-border/30 bg-[oklch(0.12_0_0)] shrink-0 flex items-center justify-center transition-colors ${
                isLastActive ? 'cursor-pointer hover:bg-[oklch(0.16_0_0)]' : 'cursor-default opacity-40'
              }`}
              disabled={!isLastActive}
              aria-label={isLastActive ? 'Add photo' : 'Photo slot'}
            >
              {isLastActive && (
                <>
                  <div className="w-16 h-16 rounded-full bg-[oklch(0.20_0_0)] flex items-center justify-center">
                    <Plus className="w-6 h-6 text-muted-foreground" />
                  </div>
                  {/* Remove/close button placeholder */}
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[oklch(0.20_0_0)] flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* Instructions */}
      <div className="text-center max-w-xs mb-10 space-y-4">
        <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">Final Review</p>
        <p className="text-sm text-foreground/70 leading-relaxed">
          Now upload up to 3 pictures of your full body. Pictures where you are wearing tighter clothes will work the best for us. Avoid pictures where you have loose clothes.
        </p>
        <p className="text-sm text-foreground/50 leading-relaxed mt-4">
          if not you can take a full body picture right now!
        </p>
        <p className="text-sm text-foreground/50 leading-relaxed">
          {'Find good illumination and stand with confidence ;)'}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={photos.length === 0}
        className="w-full max-w-xs rounded-full border border-foreground/20 bg-[oklch(0.14_0_0)] text-foreground text-xs tracking-[0.25em] uppercase py-4 px-6 hover:bg-[oklch(0.20_0_0)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Submit!
      </button>

      {/* Add more photos hint if some exist */}
      {photos.length > 0 && photos.length < 3 && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Add more photos ({photos.length}/3)
        </button>
      )}

      {/* Privacy footer */}
      <footer className="mt-auto pt-10">
        <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase text-center">
          Privacy First / Processed Locally, Never Stored
        </p>
      </footer>
    </div>
  )
}
