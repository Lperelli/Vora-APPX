'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Camera, Images, Loader2, SwitchCamera, X } from 'lucide-react'
import { hasLiveVideo, CAMERA_MESSAGES, cameraIssue, captureVideoFrame, requestVideoStream, startCaptureCountdown, stopMediaStream, waitForVideo, type CameraFacingMode, type CameraIssue } from "@/lib/camera"
import { PhotoGuidanceList } from './photo-guidance'
import { VORA_UPLOAD_PANEL_MAX } from './vora-layout'
import { usePhotoDialog } from './use-photo-dialog'
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

interface PhotoUploadFlipProps {
  slots: PhotoSlotsState
  onSlotsChange: Dispatch<SetStateAction<PhotoSlotsState>>
  onUseMeasurements: () => void
}

/**
 * Upload panel: three fixed slots (BODY 1–3). Each slot is its own 3D Y flip.
 * When several images are chosen at once, fills empty slots one-by-one with a stagger
 * so each card flips first, then the next, then the next.
 */
type CameraModalPhase = 'idle' | 'loading' | 'preview' | 'error'

export function PhotoUploadFlip({ slots, onSlotsChange, onUseMeasurements }: PhotoUploadFlipProps) {
  const prefersReducedMotion = useReducedMotion()
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraSessionRef = useRef(0)
  const cameraAbortRef = useRef<AbortController | null>(null)
  const capturePendingRef = useRef(false)
  const scheduleIdRef = useRef(0)
  const uploadTimersRef = useRef<number[]>([])
  const previewUrlsRef = useRef(new Set<string>())
  const [mounted, setMounted] = useState(false)
  const [guidanceOpen, setGuidanceOpen] = useState(true)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [cameraPhase, setCameraPhase] = useState<CameraModalPhase>('idle')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraFacing, setCameraFacing] = useState<CameraFacingMode>('environment')
  const [cameraSwitching, setCameraSwitching] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [cameraError, setCameraError] = useState<CameraIssue>('unsupported')
  const [captureError, setCaptureError] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [canSwitch, setCanSwitch] = useState(true)

  const emptyCount = slots.filter((s) => s === null).length

  useEffect(() => {
    setMounted(true)
  }, [])

  const stopCameraStream = useCallback(() => {
    cameraSessionRef.current += 1
    cameraAbortRef.current?.abort()
    cameraAbortRef.current = null
    capturePendingRef.current = false
    stopMediaStream(cameraStreamRef.current)
    cameraStreamRef.current = null
    setCameraStream(null)
    setVideoReady(false)
    setCapturing(false)
    const v = videoRef.current
    if (v) v.srcObject = null
  }, [])

  useEffect(() => {
    return () => stopCameraStream()
  }, [stopCameraStream])

  useEffect(() => {
    const v = videoRef.current
    if (!cameraStream || !v) return
    const session = cameraSessionRef.current
    const controller = new AbortController()
    setVideoReady(false)
    void waitForVideo(v, cameraStream, controller.signal).then(() => {
      if (session === cameraSessionRef.current) setVideoReady(true)
    }).catch(() => {
      if (controller.signal.aborted || session !== cameraSessionRef.current) return
      setCameraError('preview')
      stopCameraStream()
      setCameraPhase('error')
    })
    const ended = () => {
      if (session !== cameraSessionRef.current) return
      setCameraError('busy')
      stopCameraStream()
      setCameraPhase('error')
    }
    const tracks = cameraStream.getVideoTracks()
    let mutedTimer: ReturnType<typeof setTimeout> | undefined
    const muted = () => {
      if (session !== cameraSessionRef.current) return
      setVideoReady(false)
      clearTimeout(mutedTimer)
      mutedTimer = setTimeout(ended, 6000)
    }
    const unmuted = () => {
      clearTimeout(mutedTimer)
      if (session === cameraSessionRef.current && hasLiveVideo(cameraStream) && v.readyState >= 2) setVideoReady(true)
    }
    tracks.forEach(track => {
      track.addEventListener('ended', ended)
      track.addEventListener('mute', muted)
      track.addEventListener('unmute', unmuted)
    })
    return () => {
      controller.abort()
      clearTimeout(mutedTimer)
      tracks.forEach(track => {
        track.removeEventListener('ended', ended)
        track.removeEventListener('mute', muted)
        track.removeEventListener('unmute', unmuted)
      })
      v.srcObject = null
    }
  }, [cameraStream, stopCameraStream])

  useEffect(() => {
    if (cameraPhase !== 'loading' && cameraPhase !== 'preview') return
    const pause = () => {
      if (!document.hidden) return
      stopCameraStream()
      setCameraSwitching(false)
      setCameraError('inactive')
      setCameraPhase('error')
    }
    const leave = () => {
      stopCameraStream()
      setCameraSwitching(false)
      setCameraError('inactive')
      setCameraPhase('error')
    }
    document.addEventListener('visibilitychange', pause)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', pause)
      window.removeEventListener('pagehide', leave)
    }
  }, [cameraPhase, stopCameraStream])

  useEffect(() => () => {
    scheduleIdRef.current += 1
    uploadTimersRef.current.forEach(clearTimeout)
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
  }, [])

  const scheduleAddFiles = useCallback(
    (picked: File[]) => {
      const images = picked.filter((f) => f.type.startsWith('image/'))
      const toAdd = images.slice(0, emptyCount)
      if (toAdd.length === 0) return

      const runId = ++scheduleIdRef.current
      uploadTimersRef.current.forEach(clearTimeout)
      uploadTimersRef.current = []
      const makeSlot = (file: File) => {
        const preview = URL.createObjectURL(file)
        previewUrlsRef.current.add(preview)
        return { file, preview }
      }
      const fillNext = (file: File) => {
        if (scheduleIdRef.current !== runId) return
        const slot = makeSlot(file)
        onSlotsChange((prev) => {
          if (scheduleIdRef.current !== runId) return prev
          const j = prev.findIndex((s) => s === null)
          if (j === -1) return prev
          const next: PhotoSlotsState = [prev[0], prev[1], prev[2]]
          next[j] = slot
          return next
        })
      }

      if (prefersReducedMotion) {
        const additions = toAdd.map(makeSlot)
        onSlotsChange((prev) => {
          const next: PhotoSlotsState = [prev[0], prev[1], prev[2]]
          let fi = 0
          for (let i = 0; i < 3 && fi < toAdd.length; i++) {
            if (next[i] === null) {
              next[i] = additions[fi]
              fi++
            }
          }
          return next
        })
        if (fileRef.current) fileRef.current.value = ''
        return
      }

      toAdd.forEach((file, idx) => {
        uploadTimersRef.current.push(window.setTimeout(() => fillNext(file), idx * FLIP_STAGGER_MS))
      })

      uploadTimersRef.current.push(window.setTimeout(() => {
        if (scheduleIdRef.current === runId) {
          if (fileRef.current) fileRef.current.value = ''
        }
      }, (toAdd.length - 1) * FLIP_STAGGER_MS + 80))
    },
    [emptyCount, onSlotsChange, prefersReducedMotion]
  )

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    scheduleAddFiles(Array.from(e.target.files || []))
  }

  const openGallery = useCallback(() => {
    setSourceOpen(false)
    fileRef.current?.click()
  }, [])

  const closeCameraModal = useCallback(() => {
    stopCameraStream()
    setCameraSwitching(false)
    setCameraPhase('idle')
    setCaptureError(false)
  }, [stopCameraStream])

  const captureFromCamera = useCallback(async () => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0 || v.readyState < 2 || !hasLiveVideo(cameraStreamRef.current) || capturePendingRef.current) return
    const cameraSession = cameraSessionRef.current
    const signal = cameraAbortRef.current?.signal
    if (!signal) return
    capturePendingRef.current = true
    setCapturing(true)
    setCaptureError(false)
    try {
      const blob = await captureVideoFrame(v, signal)
      if (cameraSession !== cameraSessionRef.current) return
      const file = new File([blob], `vora-camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
      scheduleAddFiles([file])
      closeCameraModal()
    } catch {
      if (cameraSession === cameraSessionRef.current) setCaptureError(true)
    } finally {
      if (cameraSession === cameraSessionRef.current) {
        capturePendingRef.current = false
        setCapturing(false)
      }
    }
  }, [scheduleAddFiles, closeCameraModal])

  const startCamera = useCallback(async (facingMode: CameraFacingMode, switching = false) => {
    if (emptyCount === 0) return
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('unsupported')
      setCameraPhase('error')
      return
    }
    stopCameraStream()
    const cameraSession = cameraSessionRef.current
    const controller = new AbortController()
    cameraAbortRef.current = controller
    setCameraSwitching(switching)
    setCaptureError(false)
    setCameraPhase('loading')
    try {
      const requested = await requestVideoStream(facingMode, controller.signal)
      if (cameraSession !== cameraSessionRef.current) {
        requested.stream.getTracks().forEach((track) => track.stop())
        return
      }
      cameraStreamRef.current = requested.stream
      setCameraStream(requested.stream)
      setCameraFacing(requested.facingMode)
      setCameraPhase('preview')
      void navigator.mediaDevices.enumerateDevices?.().then(devices => {
        if (cameraSession === cameraSessionRef.current) setCanSwitch(devices.filter(device => device.kind === 'videoinput').length > 1)
      }).catch(() => {})
    } catch (error) {
      if (cameraSession === cameraSessionRef.current) {
        setCameraError(cameraIssue(error))
        setCameraPhase('error')
      }
    } finally {
      if (cameraSession === cameraSessionRef.current) setCameraSwitching(false)
    }
  }, [emptyCount, stopCameraStream])

  const openCamera = useCallback(() => {
    setSourceOpen(false)
    return startCamera(cameraFacing)
  }, [cameraFacing, startCamera])

  const switchCamera = useCallback(() => {
    const nextFacing: CameraFacingMode = cameraFacing === 'user' ? 'environment' : 'user'
    return startCamera(nextFacing, true)
  }, [cameraFacing, startCamera])

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
        facingMode={cameraFacing}
        switching={cameraSwitching}
        videoReady={videoReady}
        error={cameraError}
        capturing={capturing}
        captureError={captureError}
        canSwitch={canSwitch}
        onClose={closeCameraModal}
        onCapture={captureFromCamera}
        onSwitchCamera={() => void switchCamera()}
        onRetry={() => void openCamera()}
        onOpenGallery={() => {
          openGallery()
          closeCameraModal()
        }}
        onUseMeasurements={() => { closeCameraModal(); onUseMeasurements() }}
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
        onCamera={() => {
          setGuidanceOpen(false)
          void openCamera()
        }}
        onGallery={() => {
          setGuidanceOpen(false)
          openGallery()
        }}
      />,
      document.body
    )

  const sourcePortal =
    mounted &&
    sourceOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <PhotoSourceModal
        onClose={() => setSourceOpen(false)}
        onCamera={() => void openCamera()}
        onGallery={openGallery}
      />,
      document.body
    )

  const copyBlock = (
    <>
      <p className="mt-5 text-center text-[10px] font-medium tracking-[0.3em] text-white sm:mt-6 sm:text-[11px]">
        ONE FULL-LENGTH PHOTO
      </p>
      <div className="mt-3 space-y-3 px-0.5 text-center text-[13px] leading-relaxed text-white/58 sm:text-sm sm:leading-relaxed">
        <p>
          One clear full-length photo is enough to understand your natural proportions. Tap any empty frame or use the
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
          <Images className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Choose from library
        </button>
        <span className="py-0.5 text-[9px] font-medium uppercase tracking-[0.35em] text-white/28">or</span>
        <button
          type="button"
          onClick={() => void openCamera()}
          disabled={emptyCount === 0}
          className="flex w-full max-w-[300px] items-center justify-center gap-2.5 rounded-full border border-white/18 bg-[oklch(0.16_0_0)] py-3.5 pl-5 pr-6 text-[11px] font-medium uppercase tracking-[0.18em] text-white transition hover:border-white/28 hover:bg-[oklch(0.19_0_0)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 sm:max-w-[340px] sm:text-xs"
        >
          <Camera className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Use guided camera
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
            className="rounded-[20px] border border-white/10 bg-[oklch(0.13_0_0)] px-4 py-5 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.85)] sm:px-6 sm:py-6"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
              {slots.map((slot, i) =>
                slot ? (
                  <div key={slot.preview} className="relative aspect-[3/4] min-w-0 overflow-hidden rounded-[4px] ring-1 ring-white/12">
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
                    onClick={() => setSourceOpen(true)}
                    className="group flex aspect-[3/4] min-w-0 items-center justify-center rounded-[4px] border border-dashed border-white/32 transition hover:border-white/60 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
                    aria-label={i === 0 ? 'Add your full-length photo' : `Add optional photo ${i + 1}`}
                  >
                    <span className="px-1 text-center text-[8px] font-medium tracking-[0.18em] text-white/60 transition group-hover:text-white/85 sm:text-[9px]">
                      {i === 0 ? 'YOUR PHOTO' : 'OPTIONAL'}
                    </span>
                  </button>
                )
              )}
            </div>
            {copyBlock}
          </div>
        </div>
        {guidancePortal}
        {sourcePortal}
        {cameraPortal}
      </>
    )
  }

  return (
    <>
      <div className={`${VORA_UPLOAD_PANEL_MAX} px-1 sm:px-2`}>
        {hiddenInputs}

        <motion.div
          className="rounded-[20px] border border-white/10 bg-[oklch(0.13_0_0)] px-4 py-5 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.85)] sm:px-6 sm:py-6"
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
                onAdd={() => setSourceOpen(true)}
                onRemove={() => removeAt(i)}
              />
            ))}
          </div>
          {copyBlock}
        </motion.div>
      </div>
      {guidancePortal}
      {sourcePortal}
      {cameraPortal}
    </>
  )
}

function PhotoGuidanceModal({
  onClose,
  onCamera,
  onGallery,
}: {
  onClose: () => void
  onCamera: () => void
  onGallery: () => void
}) {
  const dialogRef = usePhotoDialog(onClose)

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/82 p-4 backdrop-blur-md"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-guidance-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" tabIndex={-1} aria-label="Close instructions" onClick={onClose} />
      <motion.div
        className="relative z-[1] w-full max-w-[430px] overflow-hidden rounded-[20px] bg-[oklch(0.965_0.006_75)] px-6 py-7 text-black shadow-[0_30px_100px_-28px_rgba(0,0,0,0.95)] sm:px-9 sm:py-9"
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
            Take one clear full-length photo. Extra photos are optional.
          </p>
        </div>

        <div className="my-6 h-px bg-black/10" />
        <PhotoGuidanceList tone="light" />

        <p className="mt-6 text-[12px] leading-[1.55] text-black/56">
          You don&apos;t need to look a certain way. We just need to clearly see your natural proportions.
        </p>

        <div className="mt-7 grid gap-2.5">
          <button
            type="button"
            onClick={onCamera}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-black px-6 text-[11px] font-medium uppercase tracking-[0.19em] text-white transition hover:bg-black/85 active:scale-[0.99]"
          >
            <Camera className="h-4 w-4" aria-hidden />
            Use guided camera
          </button>
          <button
            type="button"
            onClick={onGallery}
            className="flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-full border border-black/15 px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/68 transition hover:border-black/30 hover:text-black active:scale-[0.99]"
          >
            <Images className="h-4 w-4" aria-hidden />
            Choose from library
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function PhotoSourceModal({
  onClose,
  onCamera,
  onGallery,
}: {
  onClose: () => void
  onCamera: () => void
  onGallery: () => void
}) {
  const dialogRef = usePhotoDialog(onClose)

  return (
    <div
      className="fixed inset-0 z-[310] flex items-end justify-center bg-black/78 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:items-center sm:p-4"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-source-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" tabIndex={-1} aria-label="Close photo options" onClick={onClose} />
      <motion.div
        className="relative z-[1] w-full max-w-[430px] overflow-hidden rounded-[20px] border border-white/12 bg-[oklch(0.125_0_0)] p-4 shadow-[0_28px_90px_-25px_rgba(0,0,0,0.95)] sm:p-5"
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-4 px-1 pb-4 pt-1">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/38">Photo source</p>
            <h2 id="photo-source-title" className="mt-2 font-serif text-[27px] leading-none tracking-[-0.02em] text-white">
              Add a photo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/65 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-2.5">
          <button
            type="button"
            onClick={onCamera}
            className="group flex min-h-[82px] items-center gap-4 rounded-[20px] border border-white/14 bg-white/[0.045] px-5 text-left transition hover:border-white/28 hover:bg-white/[0.075] active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition group-hover:scale-105">
              <Camera className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-white">Guided camera</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-white/43">Live framing · front or rear lens</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onGallery}
            className="group flex min-h-[76px] items-center gap-4 rounded-[20px] border border-white/10 px-5 text-left transition hover:border-white/22 hover:bg-white/[0.035] active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/75 transition group-hover:bg-white/[0.11] group-hover:text-white">
              <Images className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-white/82">Photo library</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-white/38">Choose an existing full-length photo</span>
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function CameraCaptureModal({
  phase,
  videoRef,
  facingMode,
  switching,
  videoReady,
  error,
  capturing,
  captureError,
  canSwitch,
  onClose,
  onCapture,
  onSwitchCamera,
  onRetry,
  onOpenGallery,
  onUseMeasurements,
}: {
  phase: Exclude<CameraModalPhase, 'idle'>
  videoRef: React.RefObject<HTMLVideoElement | null>
  facingMode: CameraFacingMode
  switching: boolean
  videoReady: boolean
  error: CameraIssue
  capturing: boolean
  captureError: boolean
  canSwitch: boolean
  onClose: () => void
  onCapture: () => Promise<void>
  onSwitchCamera: () => void
  onRetry: () => void
  onOpenGallery: () => void
  onUseMeasurements: () => void
}) {
  const [poseFrame, setPoseFrame] = useState<LivePoseFrame>({ status: 'loading', points: [], alignment: 0 })
  const [frameSize, setFrameSize] = useState({ width: 320, height: 520 })
  const [showGuide, setShowGuide] = useState(true)
  const prefersReducedMotion = useReducedMotion()
  const [countdownStartedAt, setCountdownStartedAt] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(10)
  const captureCallbackRef = useRef(onCapture)
  captureCallbackRef.current = onCapture

  useEffect(() => {
    if (phase !== 'preview' || switching || !videoReady) {
      setPoseFrame({ status: 'loading', points: [], alignment: 0 })
      setCountdownStartedAt(null)
    }
  }, [phase, facingMode, switching, videoReady])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoReady) return
    const updateSize = () => setFrameSize({ width: video.videoWidth || 320, height: video.videoHeight || 520 })
    updateSize()
    video.addEventListener('resize', updateSize)
    return () => video.removeEventListener('resize', updateSize)
  }, [videoReady, videoRef])

  useEffect(() => {
    if (phase !== 'preview' || !videoReady || switching || capturing || countdownStartedAt !== null || !showGuide) return
    const video = videoRef.current
    if (!video) return

    let active = true
    let animationFrame = 0
    let lastInference = 0
    let inferenceRunning = false
    let lastVideoTime = -1
    let guideAvailable = true

    void preloadLivePoseGuide().catch(() => {
      guideAvailable = false
      if (active) setPoseFrame({ status: 'unavailable', points: [], alignment: 0 })
    })

    const update = (now: number) => {
      if (!active) return
      // Five new frames per second is sufficient for framing. Pause during the timer.
      if (guideAvailable && !document.hidden && video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastInference >= 200 && !inferenceRunning) {
        lastInference = now
        lastVideoTime = video.currentTime
        inferenceRunning = true
        void detectLivePose(video, now)
          .then((frame) => {
            if (!active) return
            setPoseFrame(frame)
            if (frame.status === 'unavailable') guideAvailable = false
          })
          .catch(() => {
            guideAvailable = false
            if (active) setPoseFrame({ status: 'unavailable', points: [], alignment: 0 })
          })
          .finally(() => {
            inferenceRunning = false
          })
      }
      if (guideAvailable) animationFrame = window.requestAnimationFrame(update)
    }

    animationFrame = window.requestAnimationFrame(update)
    return () => {
      active = false
      window.cancelAnimationFrame(animationFrame)
    }
  }, [phase, videoReady, videoRef, switching, capturing, countdownStartedAt, showGuide])

  const dialogRef = usePhotoDialog(onClose)

  // Framing is a suggestion: the saved image is checked during analysis.
  const captureReady = !switching && !capturing && videoReady
  const countingDown = countdownStartedAt !== null

  useEffect(() => {
    if (countdownStartedAt === null) return
    if (phase !== 'preview' || switching || !videoReady) {
      setCountdownStartedAt(null)
      return
    }
    return startCaptureCountdown({
      canCapture: () => !document.hidden && !!videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && hasLiveVideo(videoRef.current.srcObject as MediaStream | null),
      onTick: setCountdown,
      onCancel: () => setCountdownStartedAt(null),
      onCapture: () => {
        setCountdownStartedAt(null)
        void captureCallbackRef.current()
      },
    })
  }, [countdownStartedAt, phase, switching, videoReady])

  const startCountdown = () => {
    if (!captureReady || countingDown) return
    setCountdown(10)
    setCountdownStartedAt(Date.now())
  }
  const guidance = CAMERA_GUIDANCE[showGuide ? poseFrame.status : 'unavailable']
  const mirrored = facingMode === 'user'

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/88 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vora-camera-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
        aria-label="Close camera"
        onClick={onClose}
      />
      <div className="relative z-[1] max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[20px] border border-white/12 bg-[oklch(0.12_0_0)] p-4 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.95)] sm:p-5">
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
            <p className="text-center text-xs text-white/65" role="status">{switching ? 'Switching camera…' : 'Starting camera…'}</p>
            <p className="max-w-xs text-center text-xs leading-relaxed text-white/50">Allow camera access if your browser asks. You can also use an existing photo.</p>
            <button type="button" onClick={onOpenGallery} className="min-h-11 text-xs text-white underline underline-offset-4">Choose from photo library</button>
          </div>
        )}

        {phase === 'preview' && (
          <div className="space-y-4">
            <div className="relative mx-auto h-[min(50dvh,460px)] w-full overflow-hidden rounded-[4px] bg-black ring-1 ring-white/10">
              <video
                ref={videoRef}
                className={`absolute inset-0 h-full w-full object-contain ${mirrored ? '-scale-x-100' : ''}`}
                muted
                playsInline
                autoPlay
              />
              {showGuide && videoReady && <BodyFramingGuide status={poseFrame.status} points={countingDown ? [] : poseFrame.points} mirrored={mirrored} frameSize={frameSize} reducedMotion={!!prefersReducedMotion} />}
              {canSwitch && <button
                type="button"
                onClick={onSwitchCamera}
                disabled={switching || countingDown || capturing}
                className="absolute right-3 top-3 z-[2] flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-black/62 px-3.5 text-[9px] font-medium uppercase tracking-[0.16em] text-white shadow-lg backdrop-blur-md transition hover:border-white/38 hover:bg-black/78 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                aria-label={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
              >
                {switching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <SwitchCamera className="h-4 w-4" aria-hidden />}
                {facingMode === 'user' ? 'Front' : 'Rear'}
              </button>}
              {(!videoReady || capturing) && <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-black/40"><span role="status" className="rounded-full bg-black/75 px-4 py-3 text-xs text-white">{capturing ? 'Saving photo…' : 'Waiting for live video…'}</span></div>}
              {countingDown && (
                <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-black/15">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/45 bg-black/45 font-serif text-7xl tabular-nums text-white backdrop-blur-sm" role="status" aria-live="polite" aria-atomic="true">
                    <span className="sr-only">Photo in </span>{countdown}<span className="sr-only"> seconds</span>
                  </div>
                </div>
              )}
              {switching && (
                <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/38 backdrop-blur-[2px]">
                  <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-[9px] uppercase tracking-[0.18em] text-white/82">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Switching lens
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
                <div
                  className={`max-w-[92%] rounded-full border px-4 py-2 text-center text-[9px] font-medium uppercase tracking-[0.16em] backdrop-blur-md transition-colors ${guidance.pill}`}
                  aria-live="polite"
                >
                  {countingDown ? 'Stand naturally · keep head and feet visible' : guidance.label}
                </div>
              </div>
            </div>
            <p className="text-center text-[12px] leading-relaxed text-white/65">
              Press the timer, then step back until your head and feet are visible. The lines are a guide — you don’t need to match them exactly. One photo is enough.
            </p>
            <button type="button" aria-pressed={showGuide} onClick={() => setShowGuide(value => !value)} disabled={countingDown || capturing} className="mx-auto block min-h-11 text-[11px] text-white/70 underline underline-offset-4">{showGuide ? 'Hide framing guide' : 'Show framing guide'}</button>
            {captureError && <p role="alert" className="text-center text-xs leading-relaxed text-rose-200">{CAMERA_MESSAGES.capture}</p>}
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
                onClick={countingDown ? () => setCountdownStartedAt(null) : startCountdown}
                disabled={!captureReady}
                className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {capturing ? 'Saving photo…' : countingDown ? 'Cancel timer' : captureReady ? 'Take photo in 10 seconds' : 'Waiting for live video…'}
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4 py-2">
            <p className="text-center text-sm leading-relaxed text-white/65">
              {CAMERA_MESSAGES[error]}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-white/18 bg-[oklch(0.17_0_0)] py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-[oklch(0.2_0_0)]"
              >
                Retry guided camera
              </button>
              <button
                type="button"
                onClick={onOpenGallery}
                className="rounded-full border border-white/12 bg-transparent py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white/75 transition hover:border-white/20 hover:text-white"
              >
                Choose from photo library
              </button>
              <button
                type="button"
                onClick={onUseMeasurements}
                className="rounded-full border border-white/12 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white/75 transition hover:border-white/25"
              >
                Enter measurements instead
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

function BodyFramingGuide({
  status,
  points,
  mirrored,
  frameSize,
  reducedMotion,
}: {
  status: LivePoseStatus
  points: LivePoseFrame['points']
  mirrored: boolean
  frameSize: { width: number; height: number }
  reducedMotion: boolean
}) {
  const guides = [
    { label: 'SHOULDERS', y: 118 },
    { label: 'WAIST', y: 245 },
    { label: 'HIPS', y: 350 },
    { label: 'FEET', y: 488 },
  ] as const
  const liveColor = status === 'ready' ? '#6ee7b7' : '#f8fafc'
  const showPose = points.length > 28
  const pointX = (x: number) => (mirrored ? 1 - x : x) * 320

  return (
    <svg
      viewBox={`0 0 ${frameSize.width} ${frameSize.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full text-white"
      aria-hidden
    >
      <g transform={`scale(${frameSize.width / 320} ${frameSize.height / 520})`}>
      <defs>
        <linearGradient id="vora-camera-scan" x1="0" x2="1">
          <stop offset="0" stopColor={liveColor} stopOpacity="0" />
          <stop offset="0.5" stopColor={liveColor} stopOpacity="0.72" />
          <stop offset="1" stopColor={liveColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="318" height="518" rx="4" fill="none" stroke={liveColor} strokeOpacity="0.25" />
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
                x1={pointX(a.x)}
                y1={a.y * 520}
                x2={pointX(b.x)}
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
                cx={pointX(point.x)}
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
        {!reducedMotion && <animate attributeName="y" values="34;480;34" dur="3.2s" repeatCount="indefinite" />}
      </rect>
      </g>
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
          className="group absolute inset-0 flex items-center justify-center rounded-[4px] border border-dashed border-white/34 bg-[oklch(0.11_0_0)] transition hover:border-white/60 hover:bg-[oklch(0.14_0_0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
          }}
          tabIndex={flipped ? -1 : 0}
          aria-hidden={flipped}
          aria-label={bodyIndex === 1 ? 'Add your full-length photo' : `Add optional photo ${bodyIndex}`}

        >
          <span className="px-1 text-center text-[8px] font-medium tracking-[0.2em] text-white/65 transition group-hover:text-white/90 sm:text-[9px]">
            {bodyIndex === 1 ? 'YOUR PHOTO' : 'OPTIONAL'}
          </span>
        </button>

        {/* BACK */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[4px] bg-[oklch(0.1_0_0)] ring-1 ring-white/12 shadow-[0_14px_40px_-18px_rgba(0,0,0,0.75)]"
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
