'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
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
import { FigmaFlowShell, FIGMA_FLOW_BUTTON } from './figma-flow-shell'

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
    <FigmaFlowShell onReturn={onBack}>
      <section className="mx-auto w-full max-w-[513px] px-6 pt-8 text-center md:pt-[51px]">
        <h1 className="text-[10px] font-medium uppercase leading-5 tracking-[2px]">
          Full Body Glam / One photo
        </h1>
        <p className="mt-[18px] text-[14px] leading-[26px] tracking-[-0.3125px]">
          Take one full-body picture right now. You’ll have 10 seconds to step
          back and find your position.
        </p>
        <ol className="mx-auto mt-6 max-w-[348px] space-y-3 text-left text-[12px] leading-[26px]">
          {[
            'Place your camera upright at waist height.',
            'Face forward, with your head and feet in view.',
            'Wear fitted clothes and keep your arms slightly apart.',
          ].map((text, i) => (
            <li key={text} className="flex gap-3">
              <span className="text-[#ababab]">0{i + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <div className="mx-auto mt-7 max-w-[348px] space-y-2">
          <button
            onClick={() => void openCamera()}
            className={FIGMA_FLOW_BUTTON}
          >
            <Camera size={16} />
            Open camera
          </button>
          <button
            onClick={openNativeCamera}
            className="min-h-11 text-[11px] text-[#ababab] underline underline-offset-4"
          >
            Use my phone’s camera instead
          </button>
          {nativeError && (
            <p role="alert" className="text-[12px] leading-5">
              We couldn’t open that photo. Try taking a JPEG photo.
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 text-[10px] text-[#ababab]">
          <button
            onClick={onUseLibrary}
            className="min-h-11 underline underline-offset-4"
          >
            Use 3 photos from my library
          </button>
          <button
            onClick={onUseMeasurements}
            className="min-h-11 underline underline-offset-4"
          >
            Enter measurements
          </button>
        </div>
      </section>
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
    </FigmaFlowShell>
  )
}
