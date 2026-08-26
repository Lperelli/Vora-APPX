'use client'

import { Check } from 'lucide-react'

export const PHOTO_GUIDANCE_ITEMS = [
  'Just you',
  'Head to feet, clearly visible',
  'Good-quality photos',
  'No glasses, hats or accessories that hide your face or body',
  'Natural posture',
] as const

export function PhotoGuidanceList({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const text = tone === 'light' ? 'text-black/72' : 'text-foreground/68'
  const icon = tone === 'light' ? 'text-black/62' : 'text-foreground/70'

  return (
    <div>
      <p className={`mb-3 text-[10px] font-medium uppercase tracking-[0.24em] ${tone === 'light' ? 'text-black/50' : 'text-foreground/48'}`}>
        For best results
      </p>
      <ul className="space-y-2.5">
        {PHOTO_GUIDANCE_ITEMS.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${icon}`} strokeWidth={2} aria-hidden />
            <span className={`text-[12px] leading-[1.45] sm:text-[13px] ${text}`}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
