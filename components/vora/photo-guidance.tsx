'use client'
import { Check } from 'lucide-react'
export const PHOTO_GUIDANCE_ITEMS = [
  'Only you, visible from head to toe',
  'Face the camera, standing naturally',
  'Fitted clothes and even light',
  'Arms relaxed, slightly away from your body',
] as const
export function PhotoGuidanceList({
  tone = 'dark',
}: {
  tone?: 'dark' | 'light'
}) {
  return (
    <ul
      className={`space-y-3 text-xs leading-5 ${tone === 'light' ? 'text-[#62685b]' : 'text-white/65'}`}
    >
      {PHOTO_GUIDANCE_ITEMS.map((item) => (
        <li key={item} className="flex gap-3">
          <Check size={14} className="mt-0.5 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
export function CapturePoseIllustration({
  className = '',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 200 400"
      className={className}
      role="img"
      aria-label="Example stance: face forward with arms slightly apart"
    >
      <ellipse cx="100" cy="373" rx="64" ry="8" fill="#596c43" opacity=".08" />
      <g
        stroke="#7d8e70"
        strokeWidth="1.5"
        fill="#f6f7f1"
        strokeLinejoin="round"
      >
        <path d="M88 76L88 90Q69 94 62 114L34 207Q31 219 37 222Q44 223 48 211L74 147L77 205Q70 230 77 264L79 357L69 366Q68 371 76 371L91 371L100 258L109 371L124 371Q132 371 131 366L121 357L123 264Q130 230 123 205L126 147L152 211Q156 223 163 222Q169 219 166 207L138 114Q131 94 112 90L112 76Z" />
        <ellipse cx="100" cy="54" rx="24" ry="30" />
      </g>
      <g stroke="#a6b096" strokeWidth="1" fill="none">
        <path d="M18 61V19H56M144 19H182V61M18 334V380H56M144 380H182V334" />
        <path d="M100 12V0M100 389V400" />
      </g>
    </svg>
  )
}
