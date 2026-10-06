'use client'
import Link from 'next/link'
import { ArrowUpRight, Camera, Images, Ruler } from 'lucide-react'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'

export function IntroScreen({
  onBack,
  onUploadPhotos,
  onTakePhoto,
  onEnterMeasurements,
}: {
  onBack: () => void
  onUploadPhotos: () => void
  onTakePhoto: () => void
  onEnterMeasurements: () => void
}) {
  const choices = [
    {
      title: 'Take a photo',
      detail: 'A guided camera. One new full-length photo.',
      note: '01 PHOTO',
      icon: Camera,
      action: onTakePhoto,
    },
    {
      title: 'Choose from your library',
      detail: 'Three photos you already have, compared together.',
      note: '03 PHOTOS',
      icon: Images,
      action: onUploadPhotos,
    },
    {
      title: 'Enter measurements',
      detail: 'Use your shoulder, waist and hip measurements.',
      note: 'NO CAMERA',
      icon: Ruler,
      action: onEnterMeasurements,
    },
  ]
  return (
    <div className="flex min-h-dvh flex-col bg-[#10120f] text-[#f0eee7]">
      <VoraScreenHeader
        onReturn={onBack}
        variant="onDark"
        center={<VoraLogo />}
      />
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-10 sm:py-14">
        <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-[#a4ad96]">
          A personal approach to getting dressed
        </p>
        <h1 className="max-w-2xl font-serif text-5xl leading-[1.03] tracking-[-0.03em] sm:text-7xl">
          Style starts
          <br />
          with <em>understanding you.</em>
        </h1>
        <p className="mb-8 mt-5 max-w-md text-sm leading-7 text-[#a1a699]">
          Discover the shapes and outfits that work with your proportions.
          Choose how you’d like to begin.
        </p>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {choices.map(({ title, detail, note, icon: Icon, action }) => (
            <button
              key={title}
              onClick={action}
              className="group flex min-h-[98px] w-full items-center gap-4 py-5 text-left transition hover:bg-white/[.035] sm:gap-6 sm:px-3"
            >
              <Icon
                className="shrink-0 text-[#bcc6ad]"
                size={23}
                strokeWidth={1.3}
              />
              <span className="flex-1">
                <span className="block text-[19px] font-medium tracking-tight sm:text-xl">
                  {title}
                </span>
                <span className="mt-1 block text-[11px] leading-5 text-[#959e8b] sm:text-xs">
                  {detail}
                </span>
              </span>
              <span className="hidden text-[9px] tracking-[0.14em] text-[#9caa8c] sm:block">
                {note}
              </span>
              <ArrowUpRight
                size={18}
                className="text-[#b5c4a2] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </button>
          ))}
        </div>
      </section>
      <footer className="px-6 pb-8 text-center text-[10px] leading-6 text-[#839177]">
        Photos are processed on your device.
        <Link
          href="/privacy"
          className="ml-2 inline-block min-h-8 underline underline-offset-4"
        >
          Your privacy
        </Link>
      </footer>
    </div>
  )
}
