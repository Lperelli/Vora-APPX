'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  Camera,
  Check,
  Images,
  Loader2,
  RotateCcw,
  SwitchCamera,
  X,
  ArrowRight,
  Circle,
  ScanLine,
} from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import {
  CAMERA_MESSAGES,
  hasLiveVideo,
  startCaptureCountdown,
  type CameraFacingMode,
  type CameraIssue,
} from '@/lib/camera'
import { createPoseGuide } from '@/lib/pose-guide-client'
import {
  createPoseFeedbackTracker,
  type LivePoseFrame,
  type LivePoseStatus,
} from '@/lib/live-pose-guide'
import { CapturePoseIllustration } from './photo-guidance'
import { usePhotoDialog } from './use-photo-dialog'

export type CameraModalPhase =
  | 'idle'
  | 'loading'
  | 'preview'
  | 'review'
  | 'error'
export type CameraReviewPhoto = {
  file: File
  preview: string
  width: number
  height: number
}
const INITIAL_POSE: LivePoseFrame = {
  status: 'loading',
  points: [],
  alignment: 0,
}
const GUIDE_COPY: Record<LivePoseStatus, string> = {
  loading: 'Preparing your body guide…',
  no_body: 'Step into the frame',
  multiple_bodies: 'Keep only you in the frame',
  low_visibility: 'Find brighter, even light',
  not_full_body: 'Keep your head and feet visible',
  too_close: 'Take a small step back',
  too_far: 'Move a little closer',
  off_center: 'Move towards the centre',
  posture: 'Face the camera and stand naturally',
  ready: 'Good framing. Hold your position.',
  not_front_facing: 'Turn to face the camera',
  arms_obscured: 'Move your arms slightly away from your waist',
  hold_still: 'Hold still for a moment',
  unavailable: 'Body guide unavailable · you can still take a photo',
}

type Props = {
  phase: Exclude<CameraModalPhase, 'idle'>
  videoRef: RefObject<HTMLVideoElement | null>
  facingMode: CameraFacingMode
  switching: boolean
  videoReady: boolean
  error: CameraIssue
  capturing: boolean
  captureError: boolean
  canSwitch: boolean
  cameraDevices: Array<{ id: string; label: string }>
  cameraDeviceId: string
  onSelectCamera: (deviceId: string) => void
  reviewPhoto: CameraReviewPhoto | null
  onClose: () => void
  onCapture: () => Promise<void>
  onSwitchCamera: () => void
  onRetry: () => void
  onUsePhoto: () => void
  onNativeCamera: () => void
  onOpenGallery: () => void
  onUseMeasurements: () => void
}

export function CameraCaptureModal({
  phase,
  videoRef,
  facingMode,
  switching,
  videoReady,
  error,
  capturing,
  captureError,
  canSwitch,
  cameraDevices,
  cameraDeviceId,
  onSelectCamera,
  reviewPhoto,
  onClose,
  onCapture,
  onSwitchCamera,
  onRetry,
  onUsePhoto,
  onNativeCamera,
  onOpenGallery,
  onUseMeasurements,
}: Props) {
  const [pose, setPose] = useState(INITIAL_POSE)
  const [size, setSize] = useState({ width: 720, height: 1280 })
  const [showGuide, setShowGuide] = useState(true)
  const [guideAttempt, setGuideAttempt] = useState(0)
  const [timerStarted, setTimerStarted] = useState<number | null>(null)
  const [seconds, setSeconds] = useState(10)
  const captureRef = useRef(onCapture)
  captureRef.current = onCapture
  const dialog = usePhotoDialog(onClose)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (phase !== 'preview' || !videoReady || switching) setTimerStarted(null)
  }, [phase, videoReady, switching, facingMode])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoReady) return
    const resize = () =>
      setSize({
        width: video.videoWidth || 720,
        height: video.videoHeight || 1280,
      })
    resize()
    video.addEventListener('resize', resize)
    return () => video.removeEventListener('resize', resize)
  }, [videoRef, videoReady])

  useEffect(() => {
    setPose(INITIAL_POSE)
    if (
      phase !== 'preview' ||
      !videoReady ||
      switching ||
      capturing ||
      !showGuide
    )
      return
    const video = videoRef.current
    if (!video) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let guide: ReturnType<typeof createPoseGuide> | undefined
    const feedback = createPoseFeedbackTracker()
    let lastVideoTime = -1
    let lastResultAt = performance.now()
    const unavailable = () => {
      if (active) setPose({ status: 'unavailable', points: [], alignment: 0 })
    }
    const update = async () => {
      if (!active || !guide) return
      try {
        if (
          !document.hidden &&
          video.readyState >= 2 &&
          video.currentTime !== lastVideoTime
        ) {
          lastVideoTime = video.currentTime
          const frame = await guide.detect(video, performance.now())
          if (!active) return
          lastResultAt = performance.now()
          setPose(
            feedback(
              frame,
              performance.now(),
              video.videoWidth / video.videoHeight
            )
          )
        } else if (performance.now() - lastResultAt > 1200) {
          setPose({ status: 'no_body', points: [], alignment: 0 })
        }
        if (active) timer = setTimeout(() => void update(), 200)
      } catch {
        guide.dispose()
        unavailable()
      }
    }
    try {
      guide = createPoseGuide()
      void guide.ready
        .then(() => {
          if (active) void update()
        })
        .catch(unavailable)
    } catch {
      unavailable()
    }
    return () => {
      active = false
      clearTimeout(timer)
      guide?.dispose()
    }
  }, [
    phase,
    videoReady,
    switching,
    capturing,
    showGuide,
    guideAttempt,
    facingMode,
    videoRef,
  ])

  useEffect(() => {
    if (timerStarted === null || phase !== 'preview' || !videoReady) return
    return startCaptureCountdown({
      canCapture: () =>
        !document.hidden &&
        !!videoRef.current &&
        videoRef.current.readyState >= 2 &&
        videoRef.current.videoWidth > 0 &&
        hasLiveVideo(videoRef.current.srcObject as MediaStream | null),
      onTick: setSeconds,
      onCancel: () => setTimerStarted(null),
      onCapture: () => {
        setTimerStarted(null)
        void captureRef.current()
      },
    })
  }, [timerStarted, phase, videoReady, videoRef])

  const counting = timerStarted !== null
  const ready = videoReady && !switching && !capturing
  const hasBody =
    !['low_visibility', 'no_body', 'multiple_bodies'].includes(pose.status) &&
    [11, 12, 23, 24].every((index) => pose.points[index]?.visibility >= 0.6)
  const framed = [
    'ready',
    'hold_still',
    'posture',
    'not_front_facing',
    'arms_obscured',
  ].includes(pose.status)
  const postureClear = ['ready', 'hold_still'].includes(pose.status)
  const checks = [
    { label: 'Head to toe in frame', ok: framed },
    { label: 'Facing forward, arms relaxed', ok: postureClear },
    { label: 'Holding a steady position', ok: pose.status === 'ready' },
  ]
  const primary =
    'flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#263b2c] px-6 text-xs font-medium text-white transition hover:bg-[#354f3b] disabled:cursor-wait disabled:opacity-35'
  const secondary =
    'flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#ccd2c4] px-5 text-[11px] text-[#4e5b44] hover:bg-[#e6ebdf]'

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vora-camera-title"
      className="fixed inset-0 z-[300] overflow-y-auto bg-[#f3f0e9] text-[#263025]"
    >
      <div className="grid min-h-dvh grid-rows-[76px_1fr] sm:grid-cols-[290px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <header className="flex items-center justify-between border-b border-[#d7dccf] px-5 sm:col-span-2 sm:px-8">
          <div>
            <p className="text-[9px] uppercase tracking-[.28em] text-[#77816b]">
              Vora / The fitting room
            </p>
            <h2 id="vora-camera-title" className="mt-1 font-serif text-2xl">
              {phase === 'review' ? 'Make it yours.' : 'Find your frame.'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-[10px] uppercase tracking-widest text-[#77816b] sm:block">
              One photo, then your profile
            </span>
            <button
              onClick={onClose}
              aria-label="Close camera"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ccd2c4]"
            >
              <X size={17} />
            </button>
          </div>
        </header>
        <aside className="hidden flex-col justify-between border-r border-[#d7dccf] px-7 py-9 sm:flex">
          <div>
            <p className="text-[10px] uppercase tracking-[.22em] text-[#859177]">
              {phase === 'review' ? '02 / Review' : '01 / Capture'}
            </p>
            <h3 className="mt-4 font-serif text-[37px] leading-[1.05] tracking-tight">
              A single photo.
              <br />
              <em>Naturally you.</em>
            </h3>
            <p className="mt-4 text-xs leading-6 text-[#687360]">
              Place your camera upright at waist height. Stand back until your
              whole body is visible, with your arms slightly apart.
            </p>
          </div>
          <CapturePoseIllustration className="mx-auto my-5 h-[min(33dvh,250px)] w-36" />
          <div className="space-y-4">
            {phase === 'preview' && checks.map(({ label, ok }) => (
              <div
                key={label}
                className={`flex items-center gap-3 text-[11px] ${ok ? 'text-[#3c6146]' : 'text-[#7d8871]'}`}
              >
                {ok ? (
                  <Check size={15} />
                ) : (
                  <Circle size={12} strokeWidth={1} />
                )}
                <span>{label}</span>
              </div>
            ))}
            <p className="border-t border-[#d7dccf] pt-4 text-[10px] leading-5 text-[#79856e]">
              {phase === 'review'
                ? 'Your camera is now off. This photo stays on your device.'
                : 'The guide helps with framing. You can take your photo whenever you’re ready.'}
            </p>
          </div>
        </aside>
        <section className="flex h-[calc(100dvh-76px)] min-h-[470px] min-w-0 flex-col">
          {phase === 'preview' || (phase === 'review' && reviewPhoto) ? (
            <>
              <div className="relative min-h-[220px] flex-1 overflow-hidden bg-[#181d17]">
                {phase === 'preview' ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`absolute inset-0 h-full w-full object-contain ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                  />
                ) : (
                  <Image
                    src={reviewPhoto!.preview}
                    alt="Your captured full-length photo"
                    fill
                    unoptimized
                    sizes="(max-width:640px) 100vw, 75vw"
                    className="object-contain"
                  />
                )}
                {phase === 'preview' && videoReady && showGuide && (
                  <DetectedBodyGuide
                    frame={pose}
                    size={size}
                    mirrored={facingMode === 'user'}
                  />
                )}
                {phase === 'preview' && (
                  <div className="absolute inset-x-4 top-4 flex justify-center">
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex max-w-full items-center gap-2.5 rounded-full border border-white/15 bg-[#142015]/80 px-4 py-2.5 text-center text-[11px] leading-4 text-white backdrop-blur-md"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${pose.status === 'ready' ? 'bg-[#bbdba9]' : 'bg-white/60'}`}
                      />
                      {!videoReady
                        ? 'Starting live view…'
                        : showGuide
                          ? GUIDE_COPY[pose.status]
                          : 'Tracking hidden · take your photo when ready'}
                    </div>
                  </div>
                )}
                {phase === 'preview' && showGuide && hasBody && (
                  <span className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-2 text-[9px] uppercase tracking-[.14em] text-white/80">
                    <ScanLine size={13} />
                    Body detected
                  </span>
                )}
                {phase === 'preview' && canSwitch && (
                  <button
                    onClick={onSwitchCamera}
                    disabled={counting || capturing || switching}
                    aria-label={
                      facingMode === 'user'
                        ? 'Switch to rear camera'
                        : 'Switch to front camera'
                    }
                    className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white disabled:opacity-40"
                  >
                    <SwitchCamera size={18} />
                  </button>
                )}
                {counting && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/15">
                    <div
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      className="font-serif text-[130px] leading-none tabular-nums text-white drop-shadow-lg"
                    >
                      <span className="sr-only">Photo in </span>
                      {seconds}
                      <span className="sr-only"> seconds</span>
                    </div>
                    <p className="mt-2 rounded-full bg-black/50 px-4 py-2 text-[11px] text-white">
                      {seconds > 3
                        ? 'Step back. Find your position.'
                        : 'Stay still. You’re nearly there.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="shrink-0 border-t border-[#d7dccf] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-8">
                {phase === 'preview' ? (
                  <>
                    <div className="mb-2 flex min-h-9 items-center justify-between gap-4 text-[10px] text-[#65745a]">
                      {cameraDevices.length > 1 ? (
                        <select
                          aria-label="Camera lens"
                          value={cameraDeviceId}
                          disabled={counting || capturing || switching}
                          onChange={(e) => onSelectCamera(e.target.value)}
                          className="min-h-11 max-w-[60%] min-w-0 bg-transparent text-[11px]"
                        >
                          <option value="" disabled>
                            Camera
                          </option>
                          {cameraDevices.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          {facingMode === 'user'
                            ? 'Front camera'
                            : 'Rear camera'}{' '}
                          / full frame
                        </span>
                      )}
                      <button
                        aria-pressed={showGuide}
                        onClick={() => setShowGuide((v) => !v)}
                        className="min-h-11 underline underline-offset-4"
                      >
                        {showGuide ? 'Hide tracking' : 'Show tracking'}
                      </button>
                    </div>
                    <div className="mx-auto flex max-w-xl items-center gap-3">
                      <button
                        className={primary}
                        disabled={!ready}
                        onClick={() => {
                          if (counting) setTimerStarted(null)
                          else {
                            setSeconds(10)
                            setTimerStarted(Date.now())
                          }
                        }}
                      >
                        {capturing ? (
                          <>
                            <Loader2 size={17} />
                            Saving photo…
                          </>
                        ) : counting ? (
                          'Cancel timer'
                        ) : (
                          <>
                            <Camera size={17} />
                            {ready
                              ? 'Start 10-second timer'
                              : 'Waiting for camera…'}
                          </>
                        )}
                      </button>
                      <button
                        onClick={onNativeCamera}
                        aria-label="Use phone camera"
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#ccd2c4] text-[#506345]"
                      >
                        <Camera size={19} />
                      </button>
                    </div>
                    {captureError && (
                      <p
                        role="alert"
                        className="mt-2 text-center text-xs text-[#963e31]"
                      >
                        {CAMERA_MESSAGES.capture}
                      </p>
                    )}
                    {pose.status === 'unavailable' && (
                      <button
                        onClick={() => setGuideAttempt((n) => n + 1)}
                        className="mt-2 min-h-10 w-full text-center text-xs underline"
                      >
                        Retry body tracking
                      </button>
                    )}
                    <p className="mt-2 text-center text-[10px] text-[#7c8771]">
                      10 seconds to get into position · your photo stays private
                    </p>
                  </>
                ) : (
                  <div className="mx-auto max-w-xl py-3">
                    <p className="mb-4 text-center text-xs leading-6 text-[#69775d]">
                      Can you see your head, feet and torso clearly? This is the
                      only photo you need.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={onRetry} className={secondary}>
                        <RotateCcw size={15} />
                        Retake
                      </button>
                      <button onClick={onUsePhoto} className={primary}>
                        Use this photo
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
              {phase === 'loading' ? (
                <>
                  <Loader2
                    size={28}
                    strokeWidth={1}
                    className={reducedMotion ? '' : 'animate-spin'}
                  />
                  <p role="status" className="mt-5 font-serif text-3xl">
                    {switching
                      ? 'Changing your camera.'
                      : 'Opening your camera.'}
                  </p>
                  <p className="mt-3 max-w-sm text-xs leading-6 text-[#6d7862]">
                    Allow camera access when asked. In an in-app browser, open
                    Vora in Safari or Chrome if the camera doesn’t respond.
                  </p>
                </>
              ) : (
                <>
                  <Camera size={28} strokeWidth={1} />
                  <h3 className="mt-5 font-serif text-3xl">
                    Let’s try another way.
                  </h3>
                  <p
                    role="alert"
                    className="mt-3 max-w-sm text-xs leading-6 text-[#6d7862]"
                  >
                    {CAMERA_MESSAGES[error]}
                  </p>
                </>
              )}
              <div className="mt-7 w-full max-w-xs space-y-3">
                <button onClick={onNativeCamera} className={primary}>
                  <Camera size={16} />
                  Use phone camera
                </button>
                {phase === 'error' && (
                  <button onClick={onRetry} className={`${secondary} w-full`}>
                    Retry live camera
                  </button>
                )}
                <button
                  onClick={onOpenGallery}
                  className={`${secondary} w-full`}
                >
                  <Images size={15} />
                  Choose 3 library photos
                </button>
                <button
                  onClick={onUseMeasurements}
                  className="min-h-11 text-xs text-[#65775a] underline underline-offset-4"
                >
                  Enter measurements instead
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/** Uniform viewbox mapping follows object-contain; only detected points are drawn. */
function DetectedBodyGuide({
  frame,
  size,
  mirrored,
}: {
  frame: LivePoseFrame
  size: { width: number; height: number }
  mirrored: boolean
}) {
  const { width: w, height: h } = size
  const visible = (i: number) =>
    frame.points[i]?.visibility >= 0.5 &&
    frame.points[i].x >= 0 &&
    frame.points[i].x <= 1 &&
    frame.points[i].y >= 0 &&
    frame.points[i].y <= 1
  if (![11, 12, 23, 24].every(visible)) return null
  const coords = (i: number) => ({
    x: (mirrored ? 1 - frame.points[i].x : frame.points[i].x) * w,
    y: frame.points[i].y * h,
  })
  const indices = [0, 11, 12, 23, 24, 27, 28].filter(visible),
    points = indices.map(coords)
  const pad = Math.min(w, h) * 0.06,
    len = Math.min(w, h) * 0.055
  const x1 = Math.max(pad, Math.min(...points.map((p) => p.x)) - pad),
    x2 = Math.min(w - pad, Math.max(...points.map((p) => p.x)) + pad)
  const y1 = Math.max(pad, Math.min(...points.map((p) => p.y)) - pad),
    y2 = Math.min(h - pad, Math.max(...points.map((p) => p.y)) + pad)
  const color = frame.status === 'ready' ? '#cce5b7' : '#f1efdf'
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <path
        d={`M${x1} ${y1 + len}V${y1}H${x1 + len}M${x2 - len} ${y1}H${x2}V${y1 + len}M${x2} ${y2 - len}V${y2}H${x2 - len}M${x1 + len} ${y2}H${x1}V${y2 - len}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity=".8"
        vectorEffect="non-scaling-stroke"
      />
      {[11, 12, 23, 24].map((i) => {
        const p = coords(i)
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={Math.min(w, h) * 0.006}
            fill={color}
            fillOpacity=".85"
          />
        )
      })}
    </svg>
  )
}
