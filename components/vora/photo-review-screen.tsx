'use client'

import Image from 'next/image'
import { Check, Minus, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FigmaFlowShell, FIGMA_FLOW_BUTTON } from './figma-flow-shell'

interface PhotoAssessment {
  index: number
  status: 'used' | 'excluded' | 'conflict'
  reason?: string
}

interface PhotoReviewScreenProps {
  files: File[]
  assessments: PhotoAssessment[]
  usableCount: number
  canContinue: boolean
  onContinue: () => void
  onRetry: () => void
  onBack: () => void
  onEnterMeasurements: () => void
}

const STATUS_LABELS = {
  used: 'Ready to use',
  excluded: 'Not used',
  conflict: 'Needs another look',
} as const

export function PhotoReviewScreen({
  files,
  assessments,
  usableCount,
  canContinue,
  onContinue,
  onRetry,
  onBack,
  onEnterMeasurements,
}: PhotoReviewScreenProps) {
  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  return (
    <FigmaFlowShell onReturn={onBack}>
      <section className="mx-auto w-full max-w-[562px] px-6 pb-12 pt-6 md:pt-[35px]">
        <div className="text-center">
          <h1 className="text-[10px] font-medium uppercase leading-5 tracking-[2px]">
            Your photo check
          </h1>
          <p className="mt-[18px] text-[14px] leading-[26px] tracking-[-0.3125px]">
            {assessments.some(item => item.status === 'conflict')
              ? 'Your views suggest different proportions.'
              : `${usableCount} of ${files.length} ${files.length === 1 ? 'photo is' : 'photos are'} usable.`}
          </p>
          <p className="mx-auto mt-1 max-w-[390px] text-[12px] leading-5 text-[#ababab]">
            {canContinue
              ? 'We can use your clear, front-facing view for your style profile.'
              : assessments.some(item => item.status === 'conflict')
                ? 'We need comparable views before combining them. Keep your pose and camera angle similar in each photo.'
                : 'Replace the photos below for a clear, front-facing view.'}
          </p>
        </div>

        <ul className="mx-auto mt-7 max-w-[420px] divide-y divide-white/10 border-y border-white/10">
          {files.map((file, index) => {
            const assessment = assessments.find((item) => item.index === index)
            const status = assessment?.status ?? 'excluded'
            const StatusIcon = status === 'used' ? Check : status === 'conflict' ? RotateCcw : Minus

            return (
              <li key={`${index}-${file.name}-${file.lastModified}`} className="flex items-center gap-5 py-4">
                <div className="relative aspect-[115/165] w-[68px] shrink-0 overflow-hidden rounded-[4px] border border-white/20 bg-white/[0.025]">
                  {previews[index] && (
                    <Image
                      src={previews[index]}
                      alt={`Your selected photo ${index + 1}`}
                      fill
                      unoptimized
                      sizes="68px"
                      className="object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[10px] font-medium uppercase leading-5 tracking-[2px]">
                    Photo {index + 1}
                  </h2>
                  <p className="mt-1 flex items-center gap-2 text-[12px] leading-5 text-white">
                    <StatusIcon size={14} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
                    {STATUS_LABELS[status]}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#ababab]">
                    {assessment?.reason ?? (status === 'used'
                      ? 'A clear view of your proportions.'
                      : 'Choose a clear photo of you standing and facing the camera, head to toe.')}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mx-auto mt-7 flex w-full max-w-[348px] flex-col gap-3">
          {canContinue && (
            <button type="button" onClick={onContinue} className={FIGMA_FLOW_BUTTON}>
              Continue with {usableCount === 1 ? 'this photo' : 'these photos'}
            </button>
          )}
          <button type="button" onClick={onRetry} className={FIGMA_FLOW_BUTTON}>
            Replace photos
          </button>
          <button
            type="button"
            onClick={onEnterMeasurements}
            className="min-h-11 rounded-full px-4 text-[10px] font-medium uppercase leading-5 tracking-[2px] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Enter measurements
          </button>
          <p className="text-center text-[11px] leading-5 text-[#ababab]">
            Photos give a styling estimate, not exact body measurements.
          </p>
        </div>
      </section>
    </FigmaFlowShell>
  )
}
