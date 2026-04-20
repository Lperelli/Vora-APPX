'use client'

import Image from 'next/image'
import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

/** White @2x wordmark (preferred). Same artboard size as dark asset for swap. */
const LOGO_WHITE_SRC = '/brand/vora-logo-white@2x.png'
/** Dark @2x — used on welcome; as fallback when white asset is missing (invert for dark UI). */
const LOGO_DARK_SRC = '/brand/vora-logo@2x.png'

/**
 * Vora wordmark for dark headers (PNG @2x). Home uses `welcome-screen.tsx` with `LOGO_DARK_SRC` on light bg.
 * If `vora-logo-white@2x.png` is missing, falls back to dark PNG + invert so the mark still reads white.
 */
export function VoraLogo({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  const [src, setSrc] = useState(LOGO_WHITE_SRC)
  const isFallback = src === LOGO_DARK_SRC

  const onError = useCallback(() => {
    setSrc((s) => (s === LOGO_WHITE_SRC ? LOGO_DARK_SRC : s))
  }, [])

  return (
    <Image
      src={src}
      alt="Vora"
      width={202}
      height={48}
      priority={priority}
      onError={onError}
      className={cn(
        'h-6 w-auto max-w-[min(100%,220px)] select-none object-contain object-center',
        isFallback && 'brightness-0 invert',
        className
      )}
      sizes="(max-width: 768px) 160px, 220px"
    />
  )
}
