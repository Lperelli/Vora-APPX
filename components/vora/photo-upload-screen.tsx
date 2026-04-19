'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { PhotoUploadFlip, type PhotoSlotsState } from './photo-upload-flip'

interface PhotoUploadScreenProps {
  onSubmit: (files: File[]) => void
  onBack: () => void
}

export function PhotoUploadScreen({ onSubmit, onBack }: PhotoUploadScreenProps) {
  const [slots, setSlots] = useState<PhotoSlotsState>(() => [null, null, null])
  const prefersReducedMotion = useReducedMotion()
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  const hasPhotos = slots.some((s) => s !== null)

  useEffect(() => {
    return () => {
      slotsRef.current.forEach((p) => {
        if (p) URL.revokeObjectURL(p.preview)
      })
    }
  }, [])

  const handleSubmit = () => {
    const files = slots.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => s.file)
    if (files.length === 0) return
    onSubmit(files)
  }

  return (
    <motion.div
      className="min-h-[100dvh] bg-background flex flex-col items-stretch px-4 sm:px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-0"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <VoraScreenHeader onReturn={onBack} variant="onTheme" center={<VoraLogo />} />
      </motion.div>

      <motion.div
        className="mb-6 w-full sm:mb-8"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12, filter: 'blur(12px)' }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <PhotoUploadFlip slots={slots} onSlotsChange={setSlots} />
      </motion.div>

      {hasPhotos && (
        <>
          <motion.div
            className="mx-auto mb-8 max-w-xs space-y-4 px-2 text-center sm:mb-10"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: prefersReducedMotion ? 0 : 0.12 }}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Final Review</p>
            <p className="text-sm leading-relaxed text-foreground/70">
              Now upload up to 3 pictures of your full body. Pictures where you are wearing tighter clothes will work
              the best for us. Avoid pictures where you have loose clothes.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-foreground/50">
              If <em className="font-semibold italic text-foreground/65">not</em>, you can take a full body picture
              right now!
            </p>
            <p className="text-sm leading-relaxed text-foreground/50">
              Find good illumination and stand with confidence ;)
            </p>
          </motion.div>

          <motion.button
            onClick={handleSubmit}
            className="mx-auto min-h-[48px] w-full max-w-xs rounded-full border border-foreground/20 bg-[oklch(0.14_0_0)] px-6 py-4 text-xs uppercase tracking-[0.25em] text-foreground transition-colors hover:bg-[oklch(0.20_0_0)]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: prefersReducedMotion ? 0 : 0.18 }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            Submit!
          </motion.button>
        </>
      )}

      <footer className="mt-auto pt-10">
        <motion.p
          className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase text-center"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          Privacy First / Processed Locally, Never Stored
        </motion.p>
      </footer>
    </motion.div>
  )
}
