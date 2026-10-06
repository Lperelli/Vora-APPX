'use client'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Camera, ImagePlus, Plus, X, Ruler } from 'lucide-react'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { PhotoGuidanceList } from './photo-guidance'

export function PhotoUploadScreen({
  files,
  onFilesChange,
  onSubmit,
  onBack,
  onTakePhoto,
  onUseMeasurements,
}: {
  files: File[]
  onFilesChange: (files: File[]) => void
  onSubmit: (files: File[]) => void
  onBack: () => void
  onTakePhoto: () => void
  onUseMeasurements: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [message, setMessage] = useState('')
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])
  const addFiles = (picked: File[]) => {
    const images = picked.filter((file) => file.type.startsWith('image/'))
    const next = [...files]
    for (const file of images)
      if (
        !next.some(
          (other) =>
            other.name === file.name &&
            other.size === file.size &&
            other.lastModified === file.lastModified
        )
      )
        next.push(file)
    setMessage(
      images.length < picked.length
        ? 'Choose image files.'
        : next.length > 3
          ? 'Three photos are enough. Only the first three were added.'
          : next.length === files.length
            ? 'That photo is already selected. Choose a different one.'
            : ''
    )
    onFilesChange(next.slice(0, 3))
  }
  return (
    <div className="min-h-dvh bg-[#f3f0e9] text-[#232720]">
      <VoraScreenHeader
        onReturn={onBack}
        variant="onLight"
        center={<VoraLogo tone="light" />}
      />
      <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.26em] text-[#6b735f]">
              From your library / 03 photos
            </p>
            <h1 className="font-serif text-4xl tracking-[-0.025em] sm:text-5xl">
              Your photos. <em>Your perspective.</em>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#646b5d]">
              Choose three different, front-facing, full-length photos of
              yourself. We’ll compare your visible proportions across them.
            </p>
          </div>
          <span
            className="font-serif text-3xl text-[#747e68]"
            aria-live="polite"
          >
            {files.length}
            <span className="text-[#b2b9a7]"> / 3</span>
          </span>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(Array.from(event.target.files || []))
            event.target.value = ''
          }}
        />
        <div
          className="grid grid-cols-3 gap-2 sm:gap-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            addFiles(Array.from(event.dataTransfer.files))
          }}
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="relative aspect-[3/4] overflow-hidden rounded-t-[50px] border border-[#d6dccd] bg-[#e8ecdf] sm:rounded-t-[110px]"
            >
              {files[index] && previews[index] ? (
                <>
                  <Image
                    src={previews[index]}
                    alt={`Selected library photo ${index + 1}`}
                    fill
                    unoptimized
                    className="object-contain"
                    sizes="(max-width:640px) 30vw, 300px"
                  />
                  <button
                    onClick={() =>
                      onFilesChange(files.filter((_, i) => i !== index))
                    }
                    aria-label={`Remove photo ${index + 1}`}
                    className="absolute bottom-3 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#20291f]/85 text-white"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => input.current?.click()}
                  aria-label={`Add library photo ${index + 1}`}
                  className="flex h-full w-full flex-col items-center justify-center gap-3 transition hover:bg-[#dde4d1]"
                >
                  <Plus size={22} strokeWidth={1} />
                  <span className="text-[9px] uppercase tracking-[0.16em] text-[#6c775d]">
                    Photo 0{index + 1}
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
        {message && (
          <p role="status" className="mt-4 text-sm text-[#86533b]">
            {message}
          </p>
        )}
        <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-14">
          <PhotoGuidanceList tone="light" />
          <div>
            {files.length < 3 ? (
              <button
                onClick={() => input.current?.click()}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#26352b] px-6 text-xs text-white"
              >
                <ImagePlus size={17} />
                {files.length
                  ? `Add ${3 - files.length} more ${files.length === 2 ? 'photo' : 'photos'}`
                  : 'Choose 3 photos'}
              </button>
            ) : (
              <button
                onClick={() => onSubmit(files)}
                className="flex min-h-14 w-full items-center justify-between rounded-full bg-[#26352b] px-6 text-xs text-white"
              >
                Find my style profile
                <ArrowRight size={17} />
              </button>
            )}
            <p className="mt-3 text-center text-[11px] leading-5 text-[#747d67]">
              {files.length < 3
                ? 'Add all three photos to continue.'
                : 'Three photos selected. Ready when you are.'}
            </p>
          </div>
        </div>
        <div className="mt-9 flex flex-wrap gap-x-7 border-t border-[#d6dccd] pt-4 text-xs text-[#626c56]">
          <button
            onClick={onTakePhoto}
            className="flex min-h-11 items-center gap-2"
          >
            <Camera size={15} />
            Take 1 new photo instead
          </button>
          <button
            onClick={onUseMeasurements}
            className="flex min-h-11 items-center gap-2"
          >
            <Ruler size={15} />
            Enter measurements
          </button>
        </div>
        <p className="mt-4 text-[10px] text-[#78816e]">
          Your photos stay on your device.
        </p>
      </section>
    </div>
  )
}
