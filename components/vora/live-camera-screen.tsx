'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ArrowRight, ImagePlus, Ruler } from 'lucide-react'
import {
  hasLiveVideo,
  cameraIssue,
  captureVideoFrame,
  requestVideoStream,
  stopMediaStream,
  waitForVideo,
  type CameraFacingMode,
  type CameraIssue,
} from '@/lib/camera'
import {
  CameraCaptureModal,
  type CameraModalPhase,
  type CameraReviewPhoto,
} from './camera-capture-modal'
import { VoraLogo } from './vora-logo'
import { VoraScreenHeader } from './screen-return-button'
import { CapturePoseIllustration } from './photo-guidance'

export function LiveCameraScreen({
  onSubmit,
  onBack,
  onUseLibrary,
  onUseMeasurements,
}: {
  onSubmit: (files: File[]) => void
  onBack: () => void
  onUseLibrary: () => void
  onUseMeasurements: () => void
}) {
  const nativeCameraRef = useRef<HTMLInputElement>(null)
  const reviewPhotoRef = useRef<CameraReviewPhoto | null>(null)
  const [reviewPhoto, setReviewPhoto] = useState<CameraReviewPhoto | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraSessionRef = useRef(0)
  const cameraAbortRef = useRef<AbortController | null>(null)
  const capturePendingRef = useRef(false)
  const [cameraPhase, setCameraPhase] = useState<CameraModalPhase>('idle')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraFacing, setCameraFacing] = useState<CameraFacingMode>('user')
  const [cameraSwitching, setCameraSwitching] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [cameraError, setCameraError] = useState<CameraIssue>('unsupported')
  const [captureError, setCaptureError] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [canSwitch, setCanSwitch] = useState(false)
  const [cameraDevices, setCameraDevices] = useState<
    Array<{ id: string; label: string }>
  >([])
  const [cameraDeviceId, setCameraDeviceId] = useState('')
  const [nativeError, setNativeError] = useState(false)
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
    void waitForVideo(v, cameraStream, controller.signal)
      .then(() => {
        if (session === cameraSessionRef.current) setVideoReady(true)
      })
      .catch(() => {
        if (controller.signal.aborted || session !== cameraSessionRef.current)
          return
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
      if (
        session === cameraSessionRef.current &&
        hasLiveVideo(cameraStream) &&
        v.readyState >= 2
      )
        setVideoReady(true)
    }
    tracks.forEach((track) => {
      track.addEventListener('ended', ended)
      track.addEventListener('mute', muted)
      track.addEventListener('unmute', unmuted)
    })
    return () => {
      controller.abort()
      clearTimeout(mutedTimer)
      tracks.forEach((track) => {
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

  const clearReviewPhoto = useCallback(() => {
    const photo = reviewPhotoRef.current
    if (photo) {
      URL.revokeObjectURL(photo.preview)
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
    closeCameraModal()
    nativeCameraRef.current?.click()
  }, [closeCameraModal])

  const captureFromCamera = useCallback(async () => {
    const v = videoRef.current
    if (
      !v ||
      v.videoWidth === 0 ||
      v.readyState < 2 ||
      !hasLiveVideo(cameraStreamRef.current) ||
      capturePendingRef.current
    )
      return
    const cameraSession = cameraSessionRef.current
    const signal = cameraAbortRef.current?.signal
    if (!signal) return
    capturePendingRef.current = true
    setCapturing(true)
    setCaptureError(false)
    try {
      const blob = await captureVideoFrame(v, signal)
      if (cameraSession !== cameraSessionRef.current) return
      const file = new File([blob], `vora-camera-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })
      const preview = URL.createObjectURL(file)
      const photo = {
        file,
        preview,
        width: v.videoWidth,
        height: v.videoHeight,
      }
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

  const startCamera = useCallback(
    async (
      facingMode: CameraFacingMode,
      switching = false,
      deviceId?: string
    ) => {
      if (
        typeof window === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
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
        const requested = await requestVideoStream(
          facingMode,
          controller.signal,
          deviceId
        )
        if (cameraSession !== cameraSessionRef.current) {
          requested.stream.getTracks().forEach((track) => track.stop())
          return
        }
        cameraStreamRef.current = requested.stream
        setCameraStream(requested.stream)
        setCameraFacing(requested.facingMode)
        setCameraDeviceId(
          requested.stream.getVideoTracks()[0]?.getSettings().deviceId || ''
        )
        setCameraPhase('preview')
        void navigator.mediaDevices
          .enumerateDevices?.()
          .then((devices) => {
            if (cameraSession === cameraSessionRef.current) {
              const cameras = devices.filter(
                (device) => device.kind === 'videoinput'
              )
              setCanSwitch(cameras.length > 1)
              setCameraDevices(
                cameras
                  .map((device, index) => ({
                    id: device.deviceId,
                    label: device.label || `Camera ${index + 1}`,
                  }))
                  .filter((device) => device.id)
              )
            }
          })
          .catch(() => {})
      } catch (error) {
        if (cameraSession === cameraSessionRef.current) {
          setCameraError(cameraIssue(error))
          setCameraPhase('error')
        }
      } finally {
        if (cameraSession === cameraSessionRef.current)
          setCameraSwitching(false)
      }
    },
    [stopCameraStream, clearReviewPhoto]
  )

  const openCamera = useCallback(() => {
    return startCamera(cameraFacing)
  }, [cameraFacing, startCamera])

  const switchCamera = useCallback(() => {
    const nextFacing: CameraFacingMode =
      cameraFacing === 'user' ? 'environment' : 'user'
    return startCamera(nextFacing, true)
  }, [cameraFacing, startCamera])

  useEffect(
    () => () => {
      if (reviewPhotoRef.current)
        URL.revokeObjectURL(reviewPhotoRef.current.preview)
    },
    []
  )

  const receiveNativePhoto = async (file?: File) => {
    if (!file) return
    setNativeError(false)
    const session = cameraSessionRef.current
    const preview = URL.createObjectURL(file)
    try {
      const img = new window.Image()
      img.src = preview
      await img.decode()
      if (session !== cameraSessionRef.current) {
        URL.revokeObjectURL(preview)
        return
      }
      clearReviewPhoto()
      const photo = {
        file,
        preview,
        width: img.naturalWidth,
        height: img.naturalHeight,
      }
      reviewPhotoRef.current = photo
      setReviewPhoto(photo)
      setCameraPhase('review')
    } catch {
      URL.revokeObjectURL(preview)
      if (session === cameraSessionRef.current) setNativeError(true)
    }
  }

  return (
    <div className="min-h-dvh bg-[#f3f0e9] text-[#232720]">
      <div className="px-4 sm:px-8">
        <VoraScreenHeader
          onReturn={onBack}
          variant="onLight"
          center={<VoraLogo tone="light" />}
        />
      </div>
      <section className="mx-auto grid max-w-5xl gap-8 px-6 py-7 sm:grid-cols-[1fr_0.9fr] sm:items-center sm:gap-16 sm:py-14">
        <div>
          <p className="mb-5 text-[10px] uppercase tracking-[0.28em] text-[#62685b]">
            The fitting room / 01 photo
          </p>
          <h1 className="font-serif text-5xl leading-[1.08] tracking-[-0.035em] sm:text-6xl">
            A little space.
            <br />
            <em>Just you.</em>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[#65695f]">
            One new photo is all you need. We’ll help you find your frame, then
            give you ten seconds to step back.
          </p>
          <ol className="my-8 space-y-4 text-sm">
            {[
              'Place your phone upright at waist height.',
              'Face the camera. Keep your head and feet in view.',
              'Wear fitted clothes, with arms slightly apart.',
            ].map((text, i) => (
              <li key={text} className="flex gap-4">
                <span className="text-[10px] tabular-nums text-[#898d81]">
                  0{i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <button
            onClick={() => void openCamera()}
            className="flex min-h-14 w-full items-center justify-between rounded-full bg-[#26352b] px-6 text-xs font-medium text-white sm:max-w-sm"
          >
            <span className="flex items-center gap-3">
              <Camera size={17} />
              Open camera
            </span>
            <ArrowRight size={17} />
          </button>
          <button
            onClick={openNativeCamera}
            className="mt-3 min-h-11 w-full text-xs text-[#555e50] underline underline-offset-4 sm:max-w-sm"
          >
            Use my phone’s camera instead
          </button>
          {nativeError && (
            <p role="alert" className="mt-3 text-sm text-[#9e392c]">
              We couldn’t open that photo. Try taking a JPEG photo.
            </p>
          )}
        </div>
        <div className="hidden min-h-[480px] items-center justify-center rounded-t-[180px] border border-[#d7dbce] bg-[#e7ebdf] sm:flex">
          <CapturePoseIllustration className="h-[400px] w-[230px]" />
        </div>
      </section>
      <div className="mx-auto flex max-w-5xl flex-wrap gap-x-8 gap-y-2 border-t border-[#d8dcd1] px-6 py-6 text-xs text-[#5c6457]">
        <button
          onClick={onUseLibrary}
          className="flex min-h-11 items-center gap-2"
        >
          <ImagePlus size={15} />
          Use 3 photos from my library
        </button>
        <button
          onClick={onUseMeasurements}
          className="flex min-h-11 items-center gap-2"
        >
          <Ruler size={15} />
          Enter measurements
        </button>
        <p className="w-full text-[10px] text-[#767e6b]">
          Your photo stays on your device.
        </p>
      </div>
      <input
        ref={nativeCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void receiveNativePhoto(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      {cameraPhase !== 'idle' &&
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
            onSelectCamera={(id) => void startCamera(cameraFacing, true, id)}
            reviewPhoto={reviewPhoto}
            onClose={closeCameraModal}
            onCapture={captureFromCamera}
            onSwitchCamera={() => void switchCamera()}
            onRetry={() => void openCamera()}
            onUsePhoto={() => {
              const file = reviewPhotoRef.current?.file
              if (file) {
                closeCameraModal()
                onSubmit([file])
              }
            }}
            onNativeCamera={openNativeCamera}
            onOpenGallery={() => {
              closeCameraModal()
              onUseLibrary()
            }}
            onUseMeasurements={() => {
              closeCameraModal()
              onUseMeasurements()
            }}
          />,
          document.body
        )}
    </div>
  )
}
