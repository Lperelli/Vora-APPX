'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Camera, Loader2, Upload, X } from 'lucide-react'

export type FlipPhotoSlot = {
  file: File
  preview: string
}

export type PhotoSlot = FlipPhotoSlot | null
export type PhotoSlotsState = [PhotoSlot, PhotoSlot, PhotoSlot]

const FLIP_MS = 600
/** Time between each card starting its flip (previous card finishes). */
const FLIP_STAGGER_MS = FLIP_MS

/** Tries rear → front → generic video so phones & laptops both get a working stream when possible. */
async function requestVideoStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: { facingMode: { ideal: 'user' } }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    { video: true, audio: false },
  ]
  let lastError: unknown
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Camera unavailable')
}

interface PhotoUploadFlipProps {
  slots: PhotoSlotsState
  onSlotsChange: Dispatch<SetStateAction<PhotoSlotsState>>
}

/**
 * Upload panel: three fixed slots (BODY 1–3). Each slot is its own 3D Y flip.
 * When several images are chosen at once, fills empty slots one-by-one with a stagger
 * so each card flips first, then the next, then the next.
 */
type CameraModalPhase = 'idle' | 'loading' | 'preview' | 'error'

export function PhotoUploadFlip({ slots, onSlotsChange }: PhotoUploadFlipProps) {
  const prefersReducedMotion = useReducedMotion()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scheduleIdRef = useRef(0)
  const [mounted, setMounted] = useState(false)
  const [cameraPhase, setCameraPhase] = useState<CameraModalPhase>('idle')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

  const emptyCount = slots.filter((s) => s === null).length

  useEffect(() => {
    setMounted(true)
  }, [])

  const stopCameraStream = useCallback(() => {
    setCameraStream((cur) => {
      cur?.getTracks().forEach((t) => t.stop())
      return null
    })
    const v = videoRef.current
    if (v) v.srcObject = null
  }, [])

  useEffect(() => {
    return () => stopCameraStream()
  }, [stopCameraStream])

  useEffect(() => {
    const v = videoRef.current
    if (!cameraStream || !v) return
    v.srcObject = cameraStream
    const play = v.play()
    void play.catch(() => {})
    return () => {
      v.srcObject = null
    }
  }, [cameraStream])

  const scheduleAddFiles = useCallback(
    (picked: File[]) => {
      const images = picked.filter((f) => f.type.startsWith('image/'))
      const toAdd = images.slice(0, emptyCount)
      if (toAdd.length === 0) return

      const runId = ++scheduleIdRef.current

      const fillNext = (file: File) => {
        onSlotsChange((prev) => {
          if (scheduleIdRef.current !== runId) return prev
          const j = prev.findIndex((s) => s === null)
          if (j === -1) return prev
          const next: PhotoSlotsState = [prev[0], prev[1], prev[2]]
          next[j] = { file, preview: URL.createObjectURL(file) }
          return next
        })
      }

      if (prefersReducedMotion) {
        onSlotsChange((prev) => {
          const next: PhotoSlotsState = [prev[0], prev[1], prev[2]]
          let fi = 0
          for (let i = 0; i < 3 && fi < toAdd.length; i++) {
            if (next[i] === null) {
              next[i] = { file: toAdd[fi], preview: URL.createObjectURL(toAdd[fi]) }
              fi++
            }
          }
          return next
        })
        if (fileRef.current) fileRef.current.value = ''
        if (cameraRef.current) cameraRef.current.value = ''
        return
      }

      toAdd.forEach((file, idx) => {
        window.setTimeout(() => fillNext(file), idx * FLIP_STAGGER_MS)
      })

      window.setTimeout(() => {
        if (scheduleIdRef.current === runId) {
          if (fileRef.current) fileRef.current.value = ''
          if (cameraRef.current) cameraRef.current.value = ''
        }
      }, (toAdd.length - 1) * FLIP_STAGGER_MS + 80)
    },
    [emptyCount, onSlotsChange, prefersReducedMotion]
  )

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    scheduleAddFiles(Array.from(e.target.files || []))
  }

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    scheduleAddFiles([f])
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const openGallery = () => fileRef.current?.click()

  const closeCameraModal = useCallback(() => {
    stopCameraStream()
    setCameraPhase('idle')
  }, [stopCameraStream])

  const captureFromCamera = useCallback(() => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) return
    const w = v.videoWidth
    const h = v.videoHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0, w, h)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `vora-camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
        scheduleAddFiles([file])
        closeCameraModal()
      },
      'image/jpeg',
      0.92
    )
  }, [scheduleAddFiles, closeCameraModal])

  const openNativeCameraPicker = useCallback(() => {
    cameraRef.current?.click()
    closeCameraModal()
  }, [closeCameraModal])

  const openCamera = useCallback(async () => {
    if (emptyCount === 0) return
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      cameraRef.current?.click()
      return
    }
    stopCameraStream()
    setCameraPhase('loading')
    try {
      const stream = await requestVideoStream()
      setCameraStream(stream)
      setCameraPhase('preview')
    } catch {
      setCameraPhase('error')
    }
  }, [emptyCount, stopCameraStream])

  const removeAt = (index: number) => {
    onSlotsChange((prev) => {
      const cur = prev[index]
      if (cur) URL.revokeObjectURL(cur.preview)
      const next: PhotoSlotsState = [prev[0], prev[1], prev[2]]
      next[index] = null
      return next
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (emptyCount === 0) return
    scheduleAddFiles(Array.from(e.dataTransfer.files || []))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const hiddenInputs = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleGalleryChange}
      />
      {/* Fallback: OS camera / file picker (especially when getUserMedia is blocked or unsupported) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />
    </>
  )

  const cameraPortal =
    mounted &&
    cameraPhase !== 'idle' &&
    typeof document !== 'undefined' &&
    createPortal(
      <CameraCaptureModal
        phase={cameraPhase}
        videoRef={videoRef}
        onClose={closeCameraModal}
        onCapture={captureFromCamera}
        onFallbackNative={openNativeCameraPicker}
        onOpenGallery={() => {
          openGallery()
          closeCameraModal()
        }}
      />,
      document.body
    )

  const copyBlock = (
    <>
      <p className="mt-5 text-center text-[10px] font-medium tracking-[0.3em] text-white sm:mt-6 sm:text-[11px]">
        FULL BODY GLAM
      </p>
      <div className="mt-3 space-y-3 px-0.5 text-center text-[13px] leading-relaxed text-white/58 sm:text-sm sm:leading-relaxed">
        <p>
          Now upload up to 3 pictures of your full body. Pictures where you are wearing tighter clothes will work the
          best for us. Avoid pictures where you have loose clothes.
        </p>
        <p>
          If <em className="font-semibold italic text-white/85">not</em>, you can take a full body picture right now!
        </p>
        <p className="text-white/45">Find good illumination and stand with confidence ;)</p>
      </div>
      <div className="mt-6 flex flex-col items-center gap-2 pb-1 pt-2 sm:mt-8 sm:gap-2.5">
        <button
          type="button"
          onClick={openGallery}
          disabled={emptyCount === 0}
          className="flex w-full max-w-[300px] items-center justify-center gap-2.5 rounded-full border border-white/18 bg-[oklch(0.16_0_0)] py-3.5 pl-5 pr-6 text-[11px] font-medium uppercase tracking-[0.18em] text-white transition hover:border-white/28 hover:bg-[oklch(0.19_0_0)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 sm:max-w-[340px] sm:text-xs"
        >
          <Upload className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Upload photos
        </button>
        <span className="py-0.5 text-[9px] font-medium uppercase tracking-[0.35em] text-white/28">or</span>
        <button
          type="button"
          onClick={() => void openCamera()}
          disabled={emptyCount === 0}
          className="flex w-full max-w-[300px] items-center justify-center gap-2.5 rounded-full border border-white/18 bg-[oklch(0.16_0_0)] py-3.5 pl-5 pr-6 text-[11px] font-medium uppercase tracking-[0.18em] text-white transition hover:border-white/28 hover:bg-[oklch(0.19_0_0)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 sm:max-w-[340px] sm:text-xs"
        >
          <Camera className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Use my camera
        </button>
      </div>
    </>
  )

  if (prefersReducedMotion) {
    return (
      <>
        <div className="mx-auto w-full max-w-xl px-1">
          {hiddenInputs}
          <div
            className="rounded-3xl border border-white/10 bg-[oklch(0.13_0_0)] px-4 py-5 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.85)] sm:px-6 sm:py-6"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
              {slots.map((slot, i) =>
                slot ? (
                  <div key={slot.preview} className="relative aspect-[3/4] min-w-0 overflow-hidden rounded-2xl ring-1 ring-white/12">
                    <Image src={slot.preview} alt="" fill unoptimized className="object-cover object-top" sizes="30vw" />
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black text-white ring-1 ring-white/15"
                      aria-label="Remove photo"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <div
                    key={`rm-${i}`}
                    className="flex aspect-[3/4] min-w-0 items-center justify-center rounded-2xl border border-dashed border-white/32"
                  >
                    <span className="px-1 text-center text-[8px] font-medium tracking-[0.18em] text-white/60 sm:text-[9px]">
                      BODY {i + 1}
                    </span>
                  </div>
                )
              )}
            </div>
            {copyBlock}
          </div>
        </div>
        {cameraPortal}
      </>
    )
  }

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-1">
        {hiddenInputs}

        <motion.div
          className="rounded-3xl border border-white/10 bg-[oklch(0.13_0_0)] px-4 py-5 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.85)] sm:px-6 sm:py-6"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="presentation"
          whileHover={{ scale: 1.008 }}
          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
        >
          <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
            {slots.map((slot, i) => (
              <SlotFlipCard
                key={`slot-${i}`}
                bodyIndex={i + 1}
                slot={slot}
                flipMs={FLIP_MS}
                onRemove={() => removeAt(i)}
              />
            ))}
          </div>
          {copyBlock}
        </motion.div>
      </div>
      {cameraPortal}
    </>
  )
}

function CameraCaptureModal({
  phase,
  videoRef,
  onClose,
  onCapture,
  onFallbackNative,
  onOpenGallery,
}: {
  phase: Exclude<CameraModalPhase, 'idle'>
  videoRef: React.RefObject<HTMLVideoElement | null>
  onClose: () => void
  onCapture: () => void
  onFallbackNative: () => void
  onOpenGallery: () => void
}) {
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    if (phase !== 'preview') setVideoReady(false)
  }, [phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vora-camera-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close camera"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[oklch(0.12_0_0)] p-4 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.95)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="vora-camera-title" className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/90">
            Camera
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/80 transition hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === 'loading' && (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 py-10">
            <Loader2 className="h-10 w-10 animate-spin text-white/75" aria-hidden />
            <p className="text-center text-xs text-white/45">Starting camera…</p>
          </div>
        )}

        {phase === 'preview' && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
              <video
                ref={videoRef}
                className="max-h-[min(65dvh,520px)] w-full object-contain"
                muted
                playsInline
                autoPlay
                onLoadedData={() => setVideoReady(true)}
              />
            </div>
            <p className="text-center text-[11px] leading-relaxed text-white/45">
              Frame your full body, then capture. Works on desktop webcams and phone cameras (use HTTPS).
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/15 bg-transparent px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white/70 transition hover:border-white/25 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCapture}
                disabled={!videoReady}
                className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Capture photo
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4 py-2">
            <p className="text-center text-sm leading-relaxed text-white/65">
              We couldn&apos;t open the live camera in this browser (permissions, privacy mode, or missing camera).
              Choose another way to add a photo:
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onFallbackNative}
                className="rounded-full border border-white/18 bg-[oklch(0.17_0_0)] py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-[oklch(0.2_0_0)]"
              >
                System camera / photo library
              </button>
              <button
                type="button"
                onClick={onOpenGallery}
                className="rounded-full border border-white/12 bg-transparent py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white/75 transition hover:border-white/20 hover:text-white"
              >
                Upload from gallery
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2 text-center text-[10px] uppercase tracking-[0.2em] text-white/40 transition hover:text-white/60"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SlotFlipCard({
  bodyIndex,
  slot,
  flipMs,
  onRemove,
}: {
  bodyIndex: number
  slot: PhotoSlot
  flipMs: number
  onRemove: () => void
}) {
  const flipped = slot !== null

  return (
    <div className="min-w-0 [perspective:900px]">
      <div
        className="relative aspect-[3/4] w-full origin-center transition-transform ease-in-out [transform-style:preserve-3d]"
        style={{
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transitionDuration: `${flipMs}ms`,
        }}
      >
        {/* FRONT */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl border border-dashed border-white/34 bg-[oklch(0.11_0_0)]"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
          }}
        >
          <span className="px-1 text-center text-[8px] font-medium tracking-[0.2em] text-white/65 sm:text-[9px]">
            BODY {bodyIndex}
          </span>
        </div>

        {/* BACK */}
        <div
          className="absolute inset-0 overflow-hidden rounded-2xl bg-[oklch(0.1_0_0)] ring-1 ring-white/12 shadow-[0_14px_40px_-18px_rgba(0,0,0,0.75)]"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {slot && (
            <>
              <Image
                src={slot.preview}
                alt=""
                fill
                unoptimized
                className="object-cover object-top"
                sizes="30vw"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black text-white shadow-md ring-1 ring-white/15 transition-transform hover:scale-105"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
