'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

/** White wordmark for dark headers / full-bleed flows. Add `public/brand/vora-logo-white@2x.png` (from design repo). */
const LOGO_WHITE_SRC = '/brand/vora-logo-white@2x.png'

/**
 * Vora wordmark as image (white on transparent) for every dark UI screen.
 * Home / welcome keeps its own asset on the light header (`welcome-screen.tsx` → `/brand/vora-logo@2x.png`).
 */
export function VoraLogo({
  className,
  priority = false,
}: {
  className?: string
  /** Pass `true` for above-the-fold hero (e.g. intro overlay). */
  priority?: boolean
}) {
  return (
    <Image
      src={LOGO_WHITE_SRC}
      alt="Vora"
      width={202}
      height={48}
      priority={priority}
      className={cn('h-6 w-auto max-w-[min(100%,220px)] select-none object-contain object-center', className)}
      sizes="(max-width: 768px) 160px, 220px"
    />
  )
}
