'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Camera, Images, X } from 'lucide-react'
import { hasLiveVideo, cameraIssue, captureVideoFrame, requestVideoStream, stopMediaStream, waitForVideo, type CameraFacingMode, type CameraIssue } from "@/lib/camera"
import { PhotoGuidanceList } from './photo-guidance'
import { VORA_UPLOAD_PANEL_MAX } from './vora-layout'
import { usePhotoDialog } from './use-photo-dialog'
import { CameraCaptureModal, type CameraModalPhase, type CameraReviewPhoto } from './camera-capture-modal'

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
export function PhotoUploadFlip({ slots, onSlotsChange, onUseMeasurements }: PhotoUploadFlipProps) {
  const prefersReducedMotion = useReducedMotion()
  const fileRef = useRef<HTMLInputElement>(null)
  const nativeCameraRef = useRef<HTMLInputElement>(null)
  const reviewPhotoRef = useRef<CameraReviewPhoto | null>(null)
  const [reviewPhoto, setReviewPhoto] = useState<CameraReviewPhoto | null>(null)
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
  const [cameraFacing, setCameraFacing] = useState<CameraFacingMode>('user')
  const [cameraSwitching, setCameraSwitching] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [cameraError, setCameraError] = useState<CameraIssue>('unsupported')
  const [captureError, setCaptureError] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [canSwitch, setCanSwitch] = useState(false)
  const [cameraDevices, setCameraDevices] = useState<Array<{ id: string; label: string }>>([])
  const [cameraDeviceId, setCameraDeviceId] = useState('')

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

  const clearReviewPhoto = useCallback(() => {
    const photo = reviewPhotoRef.current
    if (photo) {
      URL.revokeObjectURL(photo.preview)
      previewUrlsRef.current.delete(photo.preview)
    }
    reviewPhotoRef.current = null
    setReviewPhoto(null)
  }, [])

  const closeCameraModal = useCallback(() => {
    stopCameraStream()
    clearReviewPhoto()
    setCameraSwitching(false)
    setCameraPhase('idle')
    setCaptureError(false)
  }, [stopCameraStream, clearReviewPhoto])

  const openNativeCamera = useCallback(() => {
    setSourceOpen(false)
    setGuidanceOpen(false)
    closeCameraModal()
    nativeCameraRef.current?.click()
  }, [closeCameraModal])

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
      const preview = URL.createObjectURL(file)
      const photo = { file, preview, width: v.videoWidth, height: v.videoHeight }
      previewUrlsRef.current.add(preview)
      stopCameraStream()
      reviewPhotoRef.current = photo
      setReviewPhoto(photo)
      setCameraPhase('review')
    } catch {
      if (cameraSession === cameraSessionRef.current) setCaptureError(true)
    } finally {
      if (cameraSession === cameraSessionRef.current) {
        capturePendingRef.current = false
        setCapturing(false)
      }
    }
  }, [stopCameraStream])

  const startCamera = useCallback(async (facingMode: CameraFacingMode, switching = false, deviceId?: string) => {
    if (emptyCount === 0) return
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('unsupported')
      setCameraPhase('error')
      return
    }
    stopCameraStream()
    clearReviewPhoto()
    setCanSwitch(false)
    const cameraSession = cameraSessionRef.current
    const controller = new AbortController()
    cameraAbortRef.current = controller
    setCameraSwitching(switching)
    setCaptureError(false)
    setCameraPhase('loading')
    try {
      const requested = await requestVideoStream(facingMode, controller.signal, deviceId)
      if (cameraSession !== cameraSessionRef.current) {
        requested.stream.getTracks().forEach((track) => track.stop())
        return
      }
      cameraStreamRef.current = requested.stream
      setCameraStream(requested.stream)
      setCameraFacing(requested.facingMode)
      setCameraDeviceId(requested.stream.getVideoTracks()[0]?.getSettings().deviceId || '')
      setCameraPhase('preview')
      void navigator.mediaDevices.enumerateDevices?.().then(devices => {
        if (cameraSession === cameraSessionRef.current) {
          const cameras = devices.filter(device => device.kind === 'videoinput')
          setCanSwitch(cameras.length > 1)
          setCameraDevices(cameras.map((device, index) => ({ id: device.deviceId, label: device.label || `Camera ${index + 1}` })).filter(device => device.id))
        }
      }).catch(() => {})
    } catch (error) {
      if (cameraSession === cameraSessionRef.current) {
        setCameraError(cameraIssue(error))
        setCameraPhase('error')
      }
    } finally {
      if (cameraSession === cameraSessionRef.current) setCameraSwitching(false)
    }
  }, [emptyCount, stopCameraStream, clearReviewPhoto])

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
      <input ref={nativeCameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={event => { scheduleAddFiles(Array.from(event.target.files || []).slice(0, 1)); event.target.value = '' }} />
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
        cameraDevices={cameraDevices}
        cameraDeviceId={cameraDeviceId}
        onSelectCamera={deviceId => void startCamera(cameraFacing, true, deviceId)}
        reviewPhoto={reviewPhoto}
        onClose={closeCameraModal}
        onCapture={captureFromCamera}
        onSwitchCamera={() => void switchCamera()}
        onRetry={() => void openCamera()}
        onUsePhoto={() => {
          if (reviewPhotoRef.current) scheduleAddFiles([reviewPhotoRef.current.file])
          closeCameraModal()
        }}
        onNativeCamera={openNativeCamera}
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
        <button type="button" onClick={openNativeCamera} disabled={emptyCount === 0} className="min-h-11 px-4 text-[11px] text-white/60 underline underline-offset-4 transition hover:text-white disabled:opacity-35">
          Take a photo with your phone camera
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
