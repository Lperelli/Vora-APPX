'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Camera, Loader2, Upload, X } from 'lucide-react'
import { PhotoGuidanceList } from './photo-guidance'
import { VORA_UPLOAD_PANEL_MAX } from './vora-layout'
import {
  detectLivePose,
  preloadLivePoseGuide,
  type LivePoseFrame,
  type LivePoseStatus,
} from '@/lib/live-pose-guide'

export type FlipPhotoSlot = {
  file: File
  preview: string
}

export type PhotoSlot = FlipPhotoSlot | null
export type PhotoSlotsState = [PhotoSlot, PhotoSlot, PhotoSlot]

const FLIP_MS = 600
/** Time between each card starting its flip (previous card finishes). */
const FLIP_STAGGER_MS = FLIP_MS

/** Tries front → rear → generic video so self-capture works naturally on phones and laptops. */
async function requestVideoStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: 'user' } }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
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
  const [guidanceOpen, setGuidanceOpen] = useState(true)
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

  const guidancePortal =
    mounted &&
    guidanceOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <PhotoGuidanceModal
        onClose={() => setGuidanceOpen(false)}
        onUpload={() => {
          setGuidanceOpen(false)
          openGallery()
        }}
      />,
      document.body
    )

  const copyBlock = (
    <>
      <p className="mt-5 text-center text-[10px] font-medium tracking-[0.3em] text-white sm:mt-6 sm:text-[11px]">
        2–3 FULL-LENGTH PHOTOS
      </p>
      <div className="mt-3 space-y-3 px-0.5 text-center text-[13px] leading-relaxed text-white/58 sm:text-sm sm:leading-relaxed">
        <p>
          Add at least 2 clear photos so we can understand your natural proportions. Tap any empty frame or use the
          options below.
        </p>
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
        <div className={`${VORA_UPLOAD_PANEL_MAX} px-1 sm:px-2`}>
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
                  <button
                    type="button"
                    key={`rm-${i}`}
                    onClick={openGallery}
                    className="group flex aspect-[3/4] min-w-0 items-center justify-center rounded-2xl border border-dashed border-white/32 transition hover:border-white/60 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
                    aria-label={`Upload photo ${i + 1}`}
                  >
                    <span className="px-1 text-center text-[8px] font-medium tracking-[0.18em] text-white/60 transition group-hover:text-white/85 sm:text-[9px]">
                      BODY {i + 1}
                    </span>
                  </button>
                )
              )}
            </div>
            {copyBlock}
          </div>
        </div>
        {guidancePortal}
        {cameraPortal}
      </>
    )
  }

  return (
    <>
      <div className={`${VORA_UPLOAD_PANEL_MAX} px-1 sm:px-2`}>
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
                onAdd={openGallery}
                onRemove={() => removeAt(i)}
              />
            ))}
          </div>
          {copyBlock}
        </motion.div>
      </div>
      {guidancePortal}
      {cameraPortal}
    </>
  )
}

function PhotoGuidanceModal({ onClose, onUpload }: { onClose: () => void; onUpload: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/82 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-guidance-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close instructions" onClick={onClose} />
      <motion.div
        className="relative z-[1] w-full max-w-[430px] overflow-hidden rounded-[26px] bg-[oklch(0.965_0.006_75)] px-6 py-7 text-black shadow-[0_30px_100px_-28px_rgba(0,0,0,0.95)] sm:px-9 sm:py-9"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.06] text-black/65 transition hover:bg-black/[0.1] hover:text-black"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-black/42">Photo guide</p>
          <h2 id="photo-guidance-title" className="mt-3 font-serif text-[31px] leading-[1.05] tracking-[-0.025em] sm:text-[36px]">
            Full-length photos
          </h2>
          <p className="mt-4 max-w-[330px] text-[13px] leading-[1.6] text-black/62 sm:text-[14px]">
            We need at least 2 full-length photos to understand your proportions.
          </p>
        </div>

        <div className="my-6 h-px bg-black/10" />
        <PhotoGuidanceList tone="light" />

        <p className="mt-6 text-[12px] leading-[1.55] text-black/56">
          You don&apos;t need to look a certain way. We just need to clearly see your natural proportions.
        </p>

        <button
          type="button"
          onClick={onUpload}
          className="mt-7 flex min-h-[50px] w-full items-center justify-center rounded-full bg-black px-6 text-[11px] font-medium uppercase tracking-[0.24em] text-white transition hover:bg-black/85 active:scale-[0.99]"
        >
          Upload
        </button>
      </motion.div>
    </div>
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
  const [poseFrame, setPoseFrame] = useState<LivePoseFrame>({ status: 'loading', points: [], alignment: 0 })
  const [readyProgress, setReadyProgress] = useState(0)

  useEffect(() => {
    if (phase !== 'preview') {
      setVideoReady(false)
      setPoseFrame({ status: 'loading', points: [], alignment: 0 })
      setReadyProgress(0)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'preview' || !videoReady) return
    const video = videoRef.current
    if (!video) return

    let active = true
    let animationFrame = 0
    let lastInference = 0
    let inferenceRunning = false
    let stableSince = 0

    void preloadLivePoseGuide().catch(() => {
      if (active) setPoseFrame({ status: 'unavailable', points: [], alignment: 0 })
    })

    const update = (now: number) => {
      if (!active) return
      if (video.readyState >= 2 && now - lastInference >= 90 && !inferenceRunning) {
        lastInference = now
        inferenceRunning = true
        void detectLivePose(video, now)
          .then((frame) => {
            if (!active) return
            setPoseFrame(frame)
            if (frame.status === 'ready') {
              if (!stableSince) stableSince = now
              setReadyProgress(Math.min(1, (now - stableSince) / 900))
            } else {
              stableSince = 0
              setReadyProgress(frame.status === 'unavailable' ? 1 : 0)
            }
          })
          .finally(() => {
            inferenceRunning = false
          })
      }
      animationFrame = window.requestAnimationFrame(update)
    }

    animationFrame = window.requestAnimationFrame(update)
    return () => {
      active = false
      window.cancelAnimationFrame(animationFrame)
    }
  }, [phase, videoReady, videoRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const captureReady =
    videoReady && (poseFrame.status === 'unavailable' || (poseFrame.status === 'ready' && readyProgress >= 1))
  const guidance = CAMERA_GUIDANCE[poseFrame.status]

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
                className="max-h-[min(65dvh,520px)] w-full -scale-x-100 object-contain"
                muted
                playsInline
                autoPlay
                onLoadedData={() => setVideoReady(true)}
              />
              <BodyFramingGuide status={poseFrame.status} points={poseFrame.points} />
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
                <div
                  className={`max-w-[92%] rounded-full border px-4 py-2 text-center text-[9px] font-medium uppercase tracking-[0.16em] backdrop-blur-md transition-colors ${guidance.pill}`}
                  aria-live="polite"
                >
                  {poseFrame.status === 'ready' && readyProgress < 1
                    ? `Hold still · ${Math.round(readyProgress * 100)}%`
                    : guidance.label}
                </div>
              </div>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-white/45">
              The guide checks framing, distance and posture on your device. No live camera frames are uploaded.
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
                disabled={!captureReady}
                className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {captureReady ? 'Capture photo' : 'Align your body'}
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

const CAMERA_GUIDANCE: Record<LivePoseStatus, { label: string; pill: string }> = {
  loading: { label: 'Preparing body guide…', pill: 'border-white/15 bg-black/45 text-white/70' },
  no_body: { label: 'Step into frame', pill: 'border-amber-200/35 bg-amber-950/45 text-amber-50' },
  low_visibility: { label: 'Use brighter, even light', pill: 'border-amber-200/35 bg-amber-950/45 text-amber-50' },
  not_full_body: { label: 'Show head and feet', pill: 'border-amber-200/35 bg-amber-950/45 text-amber-50' },
  too_close: { label: 'Step back', pill: 'border-amber-200/35 bg-amber-950/45 text-amber-50' },
  too_far: { label: 'Move a little closer', pill: 'border-amber-200/35 bg-amber-950/45 text-amber-50' },
  off_center: { label: 'Center your body', pill: 'border-amber-200/35 bg-amber-950/45 text-amber-50' },
  posture: { label: 'Relax and stand naturally', pill: 'border-amber-200/35 bg-amber-950/45 text-amber-50' },
  ready: { label: 'Ready to capture', pill: 'border-emerald-300/45 bg-emerald-950/55 text-emerald-50' },
  unavailable: { label: 'Manual capture available', pill: 'border-white/20 bg-black/55 text-white/75' },
}

const POSE_CONNECTIONS = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26],
  [25, 27],
  [26, 28],
] as const

function BodyFramingGuide({ status, points }: { status: LivePoseStatus; points: LivePoseFrame['points'] }) {
  const guides = [
    { label: 'SHOULDERS', y: 118 },
    { label: 'WAIST', y: 245 },
    { label: 'HIPS', y: 350 },
    { label: 'FEET', y: 488 },
  ] as const
  const liveColor = status === 'ready' ? '#6ee7b7' : '#f8fafc'
  const showPose = points.length > 28

  return (
    <svg
      viewBox="0 0 320 520"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full text-white"
      aria-hidden
    >
      <defs>
        <linearGradient id="vora-camera-scan" x1="0" x2="1">
          <stop offset="0" stopColor={liveColor} stopOpacity="0" />
          <stop offset="0.5" stopColor={liveColor} stopOpacity="0.72" />
          <stop offset="1" stopColor={liveColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="318" height="518" rx="18" fill="none" stroke={liveColor} strokeOpacity="0.25" />
      <path d="M18 52V25a10 10 0 0 1 10-10h28M264 15h28a10 10 0 0 1 10 10v27M302 468v27a10 10 0 0 1-10 10h-28M56 505H28a10 10 0 0 1-10-10v-27" fill="none" stroke={liveColor} strokeOpacity="0.75" strokeWidth="2" />
      <circle cx="160" cy="58" r="31" fill="none" stroke="currentColor" strokeOpacity="0.72" strokeWidth="1.5" strokeDasharray="5 6" />
      <line x1="160" y1="89" x2="160" y2="488" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.25" strokeDasharray="6 7" />
      <text x="160" y="18" textAnchor="middle" fill="currentColor" fillOpacity="0.78" fontSize="8" letterSpacing="1.6">
        HEAD
      </text>
      {guides.map(({ label, y }) => (
        <g key={label}>
          <line x1="40" y1={y} x2="280" y2={y} stroke="currentColor" strokeOpacity="0.62" strokeWidth="1.1" strokeDasharray="5 6" />
          <line x1="155" y1={y} x2="165" y2={y} stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.2" />
          <text x="12" y={y + 3} fill="currentColor" fillOpacity="0.78" fontSize="7" letterSpacing="1.1">
            {label}
          </text>
        </g>
      ))}
      {showPose && (
        <g>
          {POSE_CONNECTIONS.map(([from, to]) => {
            const a = points[from]
            const b = points[to]
            if (!a || !b || a.visibility < 0.35 || b.visibility < 0.35) return null
            return (
              <line
                key={`${from}-${to}`}
                x1={(1 - a.x) * 320}
                y1={a.y * 520}
                x2={(1 - b.x) * 320}
                y2={b.y * 520}
                stroke={liveColor}
                strokeOpacity="0.9"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )
          })}
          {[0, 11, 12, 23, 24, 25, 26, 27, 28].map((index) => {
            const point = points[index]
            if (!point || point.visibility < 0.35) return null
            return (
              <circle
                key={index}
                cx={(1 - point.x) * 320}
                cy={point.y * 520}
                r="3.25"
                fill={liveColor}
                fillOpacity="0.95"
                stroke="#050505"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
            )
          })}
        </g>
      )}
      <rect x="24" y="0" width="272" height="2" fill="url(#vora-camera-scan)" opacity="0.85">
        <animate attributeName="y" values="34;480;34" dur="3.2s" repeatCount="indefinite" />
      </rect>
    </svg>
  )
}

function SlotFlipCard({
  bodyIndex,
  slot,
  flipMs,
  onAdd,
  onRemove,
}: {
  bodyIndex: number
  slot: PhotoSlot
  flipMs: number
  onAdd: () => void
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
        <button
          type="button"
          onClick={onAdd}
          className="group absolute inset-0 flex items-center justify-center rounded-2xl border border-dashed border-white/34 bg-[oklch(0.11_0_0)] transition hover:border-white/60 hover:bg-[oklch(0.14_0_0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
          }}
          aria-label={`Upload photo ${bodyIndex}`}
        >
          <span className="px-1 text-center text-[8px] font-medium tracking-[0.2em] text-white/65 transition group-hover:text-white/90 sm:text-[9px]">
            BODY {bodyIndex}
          </span>
        </button>

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
