'use client'

import Image from 'next/image'
import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { asset } from '@/lib/base-path'

/** White wordmark used throughout the dark app flow. */
const LOGO_WHITE_SRC = '/logo white.svg'
/** Dark @2x — used on welcome; as fallback when white asset is missing (invert for dark UI). */
const LOGO_DARK_SRC = '/brand/vora-logo@2x.png'

/**
 * Vora wordmark for dark headers (PNG @2x). Home uses `welcome-screen.tsx` with `LOGO_DARK_SRC` on light bg.
 * If `vora-logo-white@2x.png` is missing, falls back to dark PNG + invert so the mark still reads white.
 */
export function VoraLogo({
  className,
  priority = false,
  tone = 'dark',
  design = 'standard',
}: {
  className?: string
  priority?: boolean
  tone?: 'dark' | 'light'
  design?: 'standard' | 'figma'
}) {
  const [src, setSrc] = useState(LOGO_WHITE_SRC)
  const isFallback = src === LOGO_DARK_SRC

  const onError = useCallback(() => {
    setSrc((s) => (s === LOGO_WHITE_SRC ? LOGO_DARK_SRC : s))
  }, [])

  if (design === 'figma') return (
    <span className={cn('relative block h-6 w-[101px] shrink-0', className)}>
      {/* Preserve the exported SVG's native dimensions; scale its Figma instance. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset('/figma/vora-wordmark.svg')} alt="Vora" width={70} height={17}
        style={{ transform: 'scale(1.4428571429, 1.4117647059)', transformOrigin: 'top left' }} />
    </span>
  )

  return (
    <Image
      src={asset(src)}
      alt="Vora"
      width={202}
      height={48}
      priority={priority}
      onError={onError}
      className={cn(
        'h-6 w-auto max-w-[min(100%,220px)] select-none object-contain object-center',
        tone === 'light' ? 'brightness-0' : isFallback && 'brightness-0 invert',
        className
      )}
      sizes="(max-width: 768px) 160px, 220px"
    />
  )
}
