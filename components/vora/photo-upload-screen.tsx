'use client'

import Image from 'next/image'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { asset } from '@/lib/base-path'
import { FigmaFlowShell, FIGMA_FLOW_BUTTON } from './figma-flow-shell'

export function PhotoUploadScreen({
  files,
  onFilesChange,
  onSubmit,
  onBack,
  onTakePhoto,
}: {
  files: File[]
  onFilesChange: (files: File[]) => void
  onSubmit: (files: File[]) => void
  onBack: () => void
  onTakePhoto: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [choosing, setChoosing] = useState(files.length > 0)
  const [message, setMessage] = useState('')
  const reviewing = files.length === 3
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  const choosePhotos = () => {
    setChoosing(true)
    input.current?.click()
  }
  const addFiles = (picked: File[]) => {
    if (!picked.length) return
    setChoosing(true)
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
    <FigmaFlowShell
      onReturn={onBack}
      nodeId={reviewing ? '3075:100' : choosing ? '3075:73' : '3075:50'}
    >
      <section
        className={`mx-auto w-full max-w-[562px] px-6 ${choosing && !reviewing ? 'pt-0' : 'pt-6 md:pt-[51px]'}`}
      >
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
          className={`flex gap-[17px] ${choosing && !reviewing ? 'justify-center md:justify-start' : 'justify-center'}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            addFiles(Array.from(event.dataTransfer.files))
          }}
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="relative aspect-[115/165] w-[115px] min-w-0 shrink rounded-[4px] border border-dashed border-white/35"
            >
              {files[index] && previews[index] ? (
                <>
                  <Image
                    src={previews[index]}
                    alt={`Selected library photo ${index + 1}`}
                    fill
                    unoptimized
                    sizes="115px"
                    className="rounded-[2px] object-contain"
                  />
                  <button
                    onClick={() =>
                      onFilesChange(files.filter((_, i) => i !== index))
                    }
                    aria-label={`Remove photo ${index + 1}`}
                    className="absolute -right-[18px] -top-[23px] z-10 flex h-11 w-11 items-center justify-center"
                  >
                    <span className="flex h-[25px] w-[25px] items-center justify-center rounded-full border border-white bg-[#0a0a0a]">
                      <Image
                        src={asset('/figma/close.png')}
                        alt=""
                        width={14}
                        height={14}
                        unoptimized
                      />
                    </span>
                  </button>
                </>
              ) : (
                <button
                  onClick={choosePhotos}
                  aria-label={`Add library photo ${index + 1}`}
                  className="group flex h-full w-full flex-col items-center justify-center gap-4 rounded-[3px] text-[10px] font-medium uppercase leading-5 tracking-[2px] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.07] text-white/65 transition-colors group-hover:bg-white/10 group-hover:text-white">
                    <Plus size={24} strokeWidth={1.25} aria-hidden="true" />
                  </span>
                  <span className="text-white/65">Photo 0{index + 1}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div
          className={`mx-auto max-w-[465px] text-center ${choosing ? 'mt-[63px]' : 'mt-[25px]'}`}
        >
          <h1 className="text-[10px] font-medium uppercase leading-5 tracking-[2px]">
            {reviewing ? 'Final review' : 'Full Body Glam'}
          </h1>
          <div
            className={`${reviewing ? 'mx-auto max-w-[348px] text-[12px]' : 'mt-[18px] text-[14px]'} leading-[26px] tracking-[-0.3125px]`}
          >
            <p>
              {reviewing
                ? 'Your three full-body photos are ready. Make sure your head, feet and torso are visible and your clothes let us see your shape.'
                : 'Upload 3 full-body photos from your library. Pictures where you are wearing tighter clothes will work the best for us. Avoid pictures where you have loose clothes.'}
            </p>
            <p className={reviewing ? 'mt-[26px]' : ''}>
              <button
                onClick={onTakePhoto}
                aria-label="Take one new photo instead"
                className="text-inherit hover:underline"
              >
                Or take <strong className="font-bold italic">one</strong>{' '}
                full-body picture right now!
              </button>
              <br />
              Find good illumination and stand with confidence ;)
            </p>
          </div>
          {message && (
            <p
              role="status"
              className="mt-3 text-[12px] leading-5 text-[#d1d5dc]"
            >
              {message}
            </p>
          )}
          <div className="mx-auto mt-[18px] flex w-full max-w-[348px] flex-col items-center gap-2">
            {reviewing ? (
              <button
                onClick={() => onSubmit(files)}
                className={`${FIGMA_FLOW_BUTTON} md:!min-h-9`}
              >
                Submit!
              </button>
            ) : (
              <>
                <button onClick={choosePhotos} className={FIGMA_FLOW_BUTTON}>
                  <Image
                    src={asset('/figma/upload.png')}
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                  />
                  {choosing && files.length
                    ? `Add ${3 - files.length} more ${files.length === 2 ? 'photo' : 'photos'}`
                    : 'Upload photos'}
                </button>
                <span className="text-[12px] font-medium uppercase leading-5 tracking-[2px]">
                  Or
                </span>
                <button onClick={onTakePhoto} className={FIGMA_FLOW_BUTTON}>
                  Use my camera
                </button>
              </>
            )}
            {choosing && !reviewing && (
              <p
                aria-live="polite"
                className="mt-1 text-[10px] leading-5 text-[#ababab]"
              >
                {files.length} of 3 photos selected
              </p>
            )}
          </div>
        </div>
      </section>
    </FigmaFlowShell>
  )
}
