'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { PhotoUploadFlip, type PhotoSlotsState } from './photo-upload-flip'
import { PhotoGuidanceList } from './photo-guidance'
import { VORA_FLOW_MAX } from './vora-layout'

interface PhotoUploadScreenProps {
  onSubmit: (files: File[]) => void
  onBack: () => void
}

export function PhotoUploadScreen({ onSubmit, onBack }: PhotoUploadScreenProps) {
  const [slots, setSlots] = useState<PhotoSlotsState>(() => [null, null, null])
  const prefersReducedMotion = useReducedMotion()
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  const photoCount = slots.filter((s) => s !== null).length
  const hasPhotos = photoCount > 0
  const hasMinimumPhotos = photoCount >= 2

  useEffect(() => {
    return () => {
      slotsRef.current.forEach((p) => {
        if (p) URL.revokeObjectURL(p.preview)
      })
    }
  }, [])

  const handleSubmit = () => {
    const files = slots.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => s.file)
    if (files.length < 2) return
    onSubmit(files)
  }

  const bottomPad = hasPhotos
    ? 'pb-[max(7.5rem,calc(env(safe-area-inset-bottom)+4.5rem))]'
    : 'pb-[max(2rem,env(safe-area-inset-bottom))]'

  return (
    <motion.div
      className={`flex min-h-[100dvh] flex-col items-stretch bg-background px-4 pt-0 sm:px-6 ${bottomPad}`}
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
            className={`${VORA_FLOW_MAX} mb-8 px-2 text-center sm:mb-10`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: prefersReducedMotion ? 0 : 0.12 }}
          >
            <div className="mx-auto max-w-xl space-y-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-left sm:p-6">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Final Review</p>
              <PhotoGuidanceList />
              <p className="border-t border-white/[0.08] pt-4 text-[11px] leading-relaxed text-foreground/50">
                {hasMinimumPhotos
                  ? `${photoCount} photos ready. You can add one more or continue.`
                  : 'Add one more full-length photo to continue.'}
              </p>
            </div>
          </motion.div>

          <motion.button
            onClick={handleSubmit}
            disabled={!hasMinimumPhotos}
            className="mx-auto min-h-[48px] w-full max-w-md rounded-full border border-foreground/20 bg-[oklch(0.14_0_0)] px-4 py-4 text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-[oklch(0.20_0_0)] disabled:cursor-not-allowed disabled:opacity-35 sm:px-6 sm:text-xs sm:tracking-[0.25em]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: prefersReducedMotion ? 0 : 0.18 }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.012 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            Next
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
