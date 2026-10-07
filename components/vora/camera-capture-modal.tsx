'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Camera, Loader2, SwitchCamera } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import {
  CAMERA_MESSAGES,
  hasLiveVideo,
  startCaptureCountdown,
  type CameraFacingMode,
  type CameraIssue,
} from '@/lib/camera'
import { createPoseGuide, type GuideState } from '@/lib/pose-guide-client'
import {
  createPoseFeedbackTracker,
  type LivePoseFrame,
  type LivePoseStatus,
} from '@/lib/live-pose-guide'
import {
  FigmaFlowHeader,
  FigmaPrivacyFooter,
  FIGMA_FLOW_BUTTON,
} from './figma-flow-shell'
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
  low_visibility: 'Make sure your whole body is clearly visible',
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
  const [guideState, setGuideState] = useState<GuideState>('loading')
  const [guideIssue, setGuideIssue] = useState<'load' | 'frame'>('load')
  const [timerStarted, setTimerStarted] = useState<number | null>(null)
  const [captureDelay, setCaptureDelay] = useState<0 | 10>(10)
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
    setGuideState('loading')
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
    const unavailable = (issue: 'load' | 'frame') => {
      if (active) {
        setGuideIssue(issue)
        setPose({ status: 'unavailable', points: [], alignment: 0 })
      }
    }
    const update = async () => {
      if (!active || !guide) return
      const started = performance.now()
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
        // Aim for fluid guidance without monopolising Safari's UI thread.
        const elapsed = performance.now() - started
        const delay =
          guide.mode === 'compatibility'
            ? Math.max(80, Math.min(500, elapsed * 2))
            : Math.max(30, 100 - elapsed)
        if (active) timer = setTimeout(() => void update(), delay)
      } catch {
        guide.dispose()
        unavailable('frame')
      }
    }
    try {
      guide = createPoseGuide({
        onStateChange: (state) => {
          if (!active) return
          setGuideState(state)
          if (state !== 'ready') setPose(INITIAL_POSE)
        },
      })
      void guide.ready
        .then(() => {
          if (active) void update()
        })
        .catch(() => unavailable('load'))
    } catch {
      unavailable('load')
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
  const frame = phase === 'review' && reviewPhoto ? reviewPhoto : size
  const controlsHeight = phase === 'preview' ? 420 : 360
  const hasBody =
    !['low_visibility', 'no_body', 'multiple_bodies'].includes(pose.status) &&
    [11, 12, 23, 24].every((index) => pose.points[index]?.visibility >= 0.6)
  const secondary =
    'min-h-11 text-[11px] text-[#ababab] underline underline-offset-4 hover:text-white'

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vora-camera-title"
      className="fixed inset-0 z-[300] overflow-y-auto bg-[#101010] font-sans text-[#d1d5dc]"
    >
      <div className="flex min-h-dvh flex-col">
        <FigmaFlowHeader onReturn={onClose} returnLabel="Close camera" />
        <section className="mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center px-5 pb-5">
          <h2
            id="vora-camera-title"
            className="mb-5 text-center text-[10px] font-medium uppercase leading-5 tracking-[2px]"
          >
            {phase === 'review'
              ? 'Final review / One photo'
              : 'Full body / One photo'}
          </h2>
          {phase === 'preview' || (phase === 'review' && reviewPhoto) ? (
            <>
              <div
                className="relative shrink-0 overflow-hidden rounded-[4px] border border-white/15 bg-[#080808]"
                style={{
                  width: `min(100%, calc(clamp(220px, calc(100dvh - ${controlsHeight}px), 620px) * ${frame.width / frame.height}))`,
                  aspectRatio: `${frame.width} / ${frame.height}`,
                }}
              >
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
                    sizes="(max-width:640px) 90vw, 600px"
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
                  <div className="absolute inset-x-3 top-3 flex justify-center">
                    <p
                      role="status"
                      aria-live="polite"
                      className="rounded-full border border-white/20 bg-black/70 px-3 py-2 text-center text-[10px] leading-4 text-white backdrop-blur-sm"
                    >
                      {!videoReady
                        ? 'Starting live view…'
                        : showGuide
                          ? pose.status === 'unavailable'
                            ? guideIssue === 'load'
                              ? 'Tracking couldn’t load. Check your connection, then retry.'
                              : 'Tracking paused. Please retry tracking.'
                            : guideState === 'recovering'
                              ? 'Adjusting body tracking for your browser…'
                              : GUIDE_COPY[pose.status]
                          : 'Tracking hidden · take your photo when ready'}
                    </p>
                  </div>
                )}
                {phase === 'preview' && showGuide && hasBody && (
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-2 text-[8px] uppercase tracking-[1.5px] text-white">
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
                    className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white disabled:opacity-40"
                  >
                    <SwitchCamera size={18} />
                  </button>
                )}
                {counting && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                    <div
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      className="text-[80px] font-light leading-none tabular-nums text-white drop-shadow-lg"
                    >
                      <span className="sr-only">Photo in </span>
                      {seconds}
                      <span className="sr-only"> seconds</span>
                    </div>
                    <p className="mt-3 rounded-full bg-black/70 px-3 py-2 text-[10px] text-white">
                      {seconds > 3
                        ? 'Step back. Find your position.'
                        : 'Stay still. You’re nearly there.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="w-full max-w-[348px] pt-3">
                {phase === 'preview' ? (
                  <>
                    <div className="mb-2 flex min-h-11 items-center justify-between gap-3 text-[10px] text-[#ababab]">
                      {cameraDevices.length > 1 ? (
                        <select
                          aria-label="Camera lens"
                          value={cameraDeviceId}
                          disabled={counting || capturing || switching}
                          onChange={(e) => onSelectCamera(e.target.value)}
                          className="min-h-11 max-w-[60%] bg-[#101010] text-[11px]"
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
                        className={secondary}
                      >
                        {showGuide ? 'Hide tracking' : 'Show tracking'}
                      </button>
                    </div>
                    <div
                      role="group"
                      aria-label="Photo timing"
                      className="mb-3 grid grid-cols-2 rounded-full border border-white/15 p-1 text-[10px] uppercase tracking-[1px]"
                    >
                      {([0, 10] as const).map((delay) => (
                        <button
                          key={delay}
                          type="button"
                          aria-pressed={captureDelay === delay}
                          disabled={counting || capturing || switching}
                          onClick={() => setCaptureDelay(delay)}
                          className={`min-h-11 rounded-full px-3 transition-colors disabled:opacity-40 ${captureDelay === delay ? 'bg-white text-[#101010]' : 'text-[#ababab] hover:text-white'}`}
                        >
                          {delay === 0 ? 'Instant photo' : '10-second timer'}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className={`${FIGMA_FLOW_BUTTON} flex-1 !px-3 !tracking-[1px]`}
                        disabled={!ready}
                        aria-label={
                          counting
                            ? 'Cancel timer'
                            : captureDelay === 0
                              ? 'Take photo now'
                              : 'Start 10-second timer'
                        }
                        onClick={() => {
                          if (counting) setTimerStarted(null)
                          else if (captureDelay === 0) void captureRef.current()
                          else {
                            setSeconds(10)
                            setTimerStarted(Date.now())
                          }
                        }}
                      >
                        {capturing
                          ? 'Saving photo…'
                          : counting
                            ? 'Cancel timer'
                            : ready
                              ? captureDelay === 0
                                ? 'Take photo now'
                                : 'Take photo / 10s'
                              : 'Waiting for camera…'}
                      </button>
                      <button
                        onClick={onNativeCamera}
                        aria-label="Use phone camera"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#2c2c2c] bg-[#1e1e1e] text-white"
                      >
                        <Camera size={16} />
                      </button>
                    </div>
                    {captureError && (
                      <p
                        role="alert"
                        className="mt-3 text-center text-[12px] leading-5"
                      >
                        {CAMERA_MESSAGES.capture}
                      </p>
                    )}
                    {pose.status === 'unavailable' && (
                      <button
                        onClick={() => setGuideAttempt((n) => n + 1)}
                        className={`${secondary} w-full`}
                      >
                        Retry body tracking
                      </button>
                    )}
                    <p className="mt-3 text-center text-[10px] leading-5 text-[#ababab]">
                      {captureDelay === 0
                        ? 'Capture as soon as you tap. Keep your whole body in view.'
                        : '10 seconds to get into position. No perfect alignment needed.'}
                    </p>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="mb-4 text-[12px] leading-[26px]">
                      Check your head, feet and torso are visible.
                      <br />
                      This is the only photo you need.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={onRetry}
                        className={`${FIGMA_FLOW_BUTTON} !w-auto !px-5`}
                      >
                        Retake
                      </button>
                      <button
                        onClick={onUsePhoto}
                        className={FIGMA_FLOW_BUTTON}
                      >
                        Use this photo
                      </button>
                    </div>
                    <p className="mt-3 text-[10px] leading-5 text-[#ababab]">
                      Your camera is now off.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex w-full max-w-[465px] flex-1 flex-col items-center justify-center py-10 text-center">
              {phase === 'loading' ? (
                <>
                  <Loader2
                    size={24}
                    strokeWidth={1}
                    className={reducedMotion ? '' : 'animate-spin'}
                  />
                  <p
                    role="status"
                    className="mt-6 text-[12px] font-medium uppercase tracking-[2px]"
                  >
                    {switching
                      ? 'Changing your camera...'
                      : 'Opening your camera...'}
                  </p>
                  <p className="mt-4 text-[12px] leading-[26px]">
                    Allow camera access when asked. If an in-app browser doesn’t
                    respond, open Vora in Safari or Chrome.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[12px] font-medium uppercase tracking-[2px]">
                    Let’s try another way.
                  </p>
                  <p role="alert" className="mt-4 text-[12px] leading-[26px]">
                    {CAMERA_MESSAGES[error]}
                  </p>
                </>
              )}
              <div className="mt-7 w-full max-w-[348px] space-y-3">
                <button onClick={onNativeCamera} className={FIGMA_FLOW_BUTTON}>
                  Use phone camera
                </button>
                {phase === 'error' && (
                  <button onClick={onRetry} className={FIGMA_FLOW_BUTTON}>
                    Retry live camera
                  </button>
                )}
                <button onClick={onOpenGallery} className={FIGMA_FLOW_BUTTON}>
                  Choose 3 library photos
                </button>
                <button onClick={onUseMeasurements} className={secondary}>
                  Enter measurements instead
                </button>
              </div>
            </div>
          )}
        </section>
        <FigmaPrivacyFooter />
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
    frame.points[i]?.visibility >= 0.6 &&
    frame.points[i].x >= 0 &&
    frame.points[i].x <= 1 &&
    frame.points[i].y >= 0 &&
    frame.points[i].y <= 1
  if (![11, 12].every(visible)) return null
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
  const color = frame.status === 'ready' ? '#ffffff' : '#bebebe'
  const joints = [
    0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32,
  ].filter(visible)
  const connections = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
    [27, 31],
    [28, 32],
  ]
  return (
    <svg
      aria-hidden
      data-testid="body-pose-overlay"
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
      {connections
        .filter(([a, b]) => visible(a) && visible(b))
        .map(([a, b]) => {
          const start = coords(a),
            end = coords(b)
          return (
            <line
              key={`${a}-${b}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={color}
              strokeWidth="1"
              strokeOpacity=".55"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      {joints.map((i) => {
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
