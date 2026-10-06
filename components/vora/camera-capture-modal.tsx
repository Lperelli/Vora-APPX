'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Camera, Check, Images, Loader2, RotateCcw, SwitchCamera, X } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { CAMERA_MESSAGES, hasLiveVideo, startCaptureCountdown, type CameraFacingMode, type CameraIssue } from '@/lib/camera'
import { createPoseGuide } from '@/lib/pose-guide-client'
import type { LivePoseFrame, LivePoseStatus } from '@/lib/live-pose-guide'
import { usePhotoDialog } from './use-photo-dialog'

export type CameraModalPhase = 'idle' | 'loading' | 'preview' | 'review' | 'error'
export type CameraReviewPhoto = { file: File; preview: string; width: number; height: number }
const INITIAL_POSE: LivePoseFrame = { status: 'loading', points: [], alignment: 0 }
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
  ready: 'Full body in view',
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

export function CameraCaptureModal({ phase, videoRef, facingMode, switching, videoReady, error, capturing, captureError, canSwitch, cameraDevices, cameraDeviceId, onSelectCamera, reviewPhoto, onClose, onCapture, onSwitchCamera, onRetry, onUsePhoto, onNativeCamera, onOpenGallery, onUseMeasurements }: Props) {
  const [pose, setPose] = useState(INITIAL_POSE)
  const [size, setSize] = useState({ width: 720, height: 1280 })
  const [showGuide, setShowGuide] = useState(true)
  const [guideAttempt, setGuideAttempt] = useState(0)
  const [lensPickerOpen, setLensPickerOpen] = useState(false)
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
    const resize = () => setSize({ width: video.videoWidth || 720, height: video.videoHeight || 1280 })
    resize()
    video.addEventListener('resize', resize)
    return () => video.removeEventListener('resize', resize)
  }, [videoRef, videoReady])

  useEffect(() => {
    setPose(INITIAL_POSE)
    if (phase !== 'preview' || !videoReady || switching || capturing || !showGuide) return
    const video = videoRef.current
    if (!video) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let guide: ReturnType<typeof createPoseGuide> | undefined
    let lastVideoTime = -1
    let lastResultAt = performance.now()
    const unavailable = () => { if (active) setPose({ status: 'unavailable', points: [], alignment: 0 }) }
    const update = async () => {
      if (!active || !guide) return
      try {
        if (!document.hidden && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime
          const frame = await guide.detect(video, performance.now())
          if (!active) return
          lastResultAt = performance.now()
          setPose(frame)
        } else if (performance.now() - lastResultAt > 1200) {
          setPose({ status: 'no_body', points: [], alignment: 0 })
        }
        if (active) timer = setTimeout(() => void update(), 200)
      } catch { guide.dispose(); unavailable() }
    }
    try {
      guide = createPoseGuide()
      void guide.ready.then(() => { if (active) void update() }).catch(unavailable)
    } catch { unavailable() }
    return () => { active = false; clearTimeout(timer); guide?.dispose() }
  }, [phase, videoReady, switching, capturing, showGuide, guideAttempt, facingMode, videoRef])

  useEffect(() => {
    if (timerStarted === null || phase !== 'preview' || !videoReady) return
    return startCaptureCountdown({
      canCapture: () => !document.hidden && !!videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && hasLiveVideo(videoRef.current.srcObject as MediaStream | null),
      onTick: setSeconds,
      onCancel: () => setTimerStarted(null),
      onCapture: () => { setTimerStarted(null); void captureRef.current() },
    })
  }, [timerStarted, phase, videoReady, videoRef])

  const counting = timerStarted !== null
  const ready = videoReady && !switching && !capturing
  const frame = phase === 'review' && reviewPhoto ? reviewPhoto : size
  const aspect = frame.width / frame.height
  const detected = showGuide && pose.points.length >= 29 && !['loading', 'no_body', 'low_visibility', 'unavailable'].includes(pose.status)
  const secondary = 'flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-[11px] text-white/75 transition hover:border-white/40 hover:text-white disabled:opacity-40'
  const primary = 'flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#f4f0e8] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#161512] transition hover:bg-white disabled:cursor-wait disabled:opacity-35'

  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="vora-camera-title" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <button type="button" tabIndex={-1} className="absolute inset-0 cursor-default" aria-label="Close camera" onClick={onClose} />
      <div className={`relative z-[1] max-h-[calc(100dvh-2rem)] w-full ${phase === 'preview' || phase === 'review' ? 'max-w-3xl' : 'max-w-lg'} overflow-y-auto rounded-3xl border border-white/15 bg-[#101010] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.6)] sm:p-6`}>
        <header className="mb-4 flex items-start justify-between gap-3">
          <div><p className="mb-1 text-[9px] uppercase tracking-[0.3em] text-white/45">Vora photo studio</p><h2 id="vora-camera-title" className="font-serif text-2xl text-[#f4f0e8]">{phase === 'review' ? 'A moment to review.' : 'Your proportions, naturally.'}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/65 transition hover:bg-white/10"><X className="h-4 w-4" /></button>
        </header>

        {phase === 'loading' && <div className="flex min-h-64 flex-col items-center justify-center gap-4 py-6 text-center">
          <Loader2 className={`h-8 w-8 text-white/70 ${reducedMotion ? '' : 'animate-spin'}`} aria-hidden />
          <p role="status" className="text-sm text-white/80">{switching ? 'Switching camera…' : 'Opening your camera…'}</p>
          <p className="max-w-xs text-xs leading-6 text-white/50">Allow camera access when asked. If you are inside another app, try opening Vora in Safari or Chrome.</p>
          <button type="button" onClick={onNativeCamera} className={secondary}><Camera className="h-4 w-4" />Use phone camera</button>
          <button type="button" onClick={onOpenGallery} className="min-h-11 text-xs text-white/60 underline underline-offset-4">Choose an existing photo</button>
        </div>}

        {(phase === 'preview' || (phase === 'review' && reviewPhoto)) && <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] sm:items-center sm:gap-6">
          <div className="relative mx-auto overflow-hidden rounded-xl bg-black ring-1 ring-white/10 [--studio-height:min(42dvh,420px)] sm:[--studio-height:min(65dvh,540px)]" style={{ aspectRatio: aspect, width: `min(100%, calc(var(--studio-height) * ${aspect}))` }}>
            {phase === 'preview' ? <video ref={videoRef} muted playsInline autoPlay className={`absolute inset-0 h-full w-full object-contain ${facingMode === 'user' ? '-scale-x-100' : ''}`} /> : <Image src={reviewPhoto!.preview} alt="Your captured full-length photo" fill unoptimized sizes="(max-width: 640px) 90vw, 460px" className="object-contain" />}
            {phase === 'preview' && showGuide && videoReady && <DetectedBodyGuide frame={pose} size={size} mirrored={facingMode === 'user'} />}
            {phase === 'preview' && !videoReady && <div role="status" className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">Waiting for live video…</div>}
            {phase === 'preview' && canSwitch && <button type="button" onClick={onSwitchCamera} disabled={counting || capturing || switching} aria-label={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white backdrop-blur-sm disabled:opacity-40"><SwitchCamera className="h-4 w-4" /></button>}
            {counting && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15"><div role="status" aria-live="polite" aria-atomic="true" className="flex h-24 w-24 items-center justify-center rounded-full border border-white/50 bg-black/45 font-serif text-6xl tabular-nums text-white backdrop-blur-sm"><span className="sr-only">Photo in </span>{seconds}<span className="sr-only"> seconds</span></div></div>}
          </div>
          <div>
          {phase === 'preview' ? <>
            <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-white/45 sm:mt-0">{cameraDevices.length > 2 ? <button type="button" aria-expanded={lensPickerOpen} onClick={() => setLensPickerOpen(value => !value)} className="min-h-9 text-left underline underline-offset-4 hover:text-white">{facingMode === 'user' ? 'Front camera' : 'Rear camera'} · choose lens</button> : <span>{facingMode === 'user' ? 'Front camera' : 'Rear camera'} · full frame</span>}<button type="button" aria-pressed={showGuide} disabled={capturing} onClick={() => setShowGuide(value => !value)} className="min-h-9 underline underline-offset-4 hover:text-white">{showGuide ? 'Hide guide' : 'Show guide'}</button></div>
            {lensPickerOpen && cameraDevices.length > 2 && <label className="mb-3 flex min-h-11 items-center gap-3 text-[11px] text-white/60"><select aria-label="Camera lens" value={cameraDeviceId} disabled={counting || capturing || switching} onChange={event => { setLensPickerOpen(false); onSelectCamera(event.target.value) }} className="min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#171717] px-2 text-[11px] text-white"><option value="" disabled>Choose a lens</option>{cameraDevices.map(device => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label>}
            <div className="mb-3 flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" role="status" aria-live="polite" aria-atomic="true">
              <span className={`h-2 w-2 shrink-0 rounded-full ${showGuide && pose.status === 'ready' ? 'bg-emerald-300' : detected ? 'bg-[#e2c68c]' : 'bg-white/35'}`} />
              <div className="flex-1"><p className="text-[12px] text-white/90">{showGuide ? GUIDE_COPY[pose.status] : 'Guide hidden · take your photo when ready'}</p>{detected && pose.status !== 'ready' && <p className="mt-0.5 text-[10px] text-white/45">Body detected</p>}</div>
              {showGuide && pose.status === 'unavailable' && <button type="button" onClick={() => setGuideAttempt(value => value + 1)} className="min-h-10 text-[11px] text-white underline underline-offset-4">Retry guide</button>}
            </div>
            <p className="mb-4 text-center text-[11px] leading-5 text-white/50">Set your phone at waist height. Start the timer, then step back. One full-length photo is enough.</p>
            {captureError && <p role="alert" className="mb-3 text-center text-xs text-rose-200">{CAMERA_MESSAGES.capture}</p>}
            <button type="button" className={primary} disabled={!ready} onClick={() => { if (counting) setTimerStarted(null); else { setSeconds(10); setTimerStarted(Date.now()) } }}>
              {capturing ? <><Loader2 className="h-4 w-4" />Saving photo…</> : counting ? 'Cancel timer' : <><Camera className="h-4 w-4" />{ready ? 'Take photo in 10 seconds' : 'Waiting for live video…'}</>}
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={onOpenGallery} className={secondary}><Images className="h-4 w-4" />Photo library</button><button type="button" onClick={onNativeCamera} className={secondary}><Camera className="h-4 w-4" />Phone camera</button></div>
          </> : <div className="mt-5 space-y-3">
            <p className="mb-4 text-center text-xs leading-6 text-white/60">Check that your head and feet are visible and your arms sit slightly away from your body.</p>
            <button type="button" onClick={onUsePhoto} className={primary}><Check className="h-4 w-4" />Use this photo</button>
            <button type="button" onClick={onRetry} className={`${secondary} w-full`}><RotateCcw className="h-4 w-4" />Retake photo</button>
          </div>}
          </div>
        </div>}

        {phase === 'error' && <div className="space-y-3 py-4 text-center">
          <p role="alert" className="mb-5 text-sm leading-6 text-white/65">{CAMERA_MESSAGES[error]}</p>
          <button type="button" onClick={onNativeCamera} className={primary}><Camera className="h-4 w-4" />Use phone camera</button>
          <button type="button" onClick={onRetry} className={`${secondary} w-full`}>Retry guided camera</button>
          <button type="button" onClick={onOpenGallery} className={`${secondary} w-full`}>Choose from photo library</button>
          <button type="button" onClick={onUseMeasurements} className="min-h-11 text-xs text-white/60 underline underline-offset-4">Enter measurements instead</button>
        </div>}
        <p className="mt-4 text-center text-[9px] tracking-wide text-white/35">Your photo stays on your device.</p>
      </div>
    </div>
  )
}

const CONNECTIONS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]] as const
const LANDMARKS = [0,11,12,13,14,15,16,23,24,25,26,27,28]

/** The SVG and video share the same viewbox: no stretch or fabricated body outline. */
function DetectedBodyGuide({ frame, size, mirrored }: { frame: LivePoseFrame; size: { width: number; height: number }; mirrored: boolean }) {
  const { width: w, height: h } = size
  const valid = (index: number) => { const p = frame.points[index]; return p && p.visibility >= 0.45 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 }
  const points = LANDMARKS.filter(valid).map(index => ({ index, x: (mirrored ? 1 - frame.points[index].x : frame.points[index].x) * w, y: frame.points[index].y * h }))
  const body = [11,12,23,24].every(valid)
  const color = frame.status === 'ready' ? '#9be5c7' : '#e2c68c'
  const pad = Math.min(w,h) * 0.045
  const length = Math.min(w,h) * 0.07
  const x1 = body ? Math.max(pad, Math.min(...points.map(p => p.x)) - pad) : pad
  const x2 = body ? Math.min(w-pad, Math.max(...points.map(p => p.x)) + pad) : w-pad
  const y1 = body ? Math.max(pad, Math.min(...points.map(p => p.y)) - pad) : pad
  const y2 = body ? Math.min(h-pad, Math.max(...points.map(p => p.y)) + pad) : h-pad
  return <svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 h-full w-full">
    <path d={`M${x1} ${y1+length}V${y1}H${x1+length} M${x2-length} ${y1}H${x2}V${y1+length} M${x2} ${y2-length}V${y2}H${x2-length} M${x1+length} ${y2}H${x1}V${y2-length}`} fill="none" stroke={body ? color : '#ffffff'} strokeOpacity={body ? 0.9 : 0.4} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    {body && <g>{CONNECTIONS.map(([a,b]) => valid(a) && valid(b) ? <line key={`${a}-${b}`} x1={(mirrored ? 1-frame.points[a].x : frame.points[a].x)*w} y1={frame.points[a].y*h} x2={(mirrored ? 1-frame.points[b].x : frame.points[b].x)*w} y2={frame.points[b].y*h} stroke={color} strokeOpacity="0.8" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /> : null)}{points.map(p => <circle key={p.index} cx={p.x} cy={p.y} r={Math.min(w,h)*0.008} fill={color} stroke="#101010" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}</g>}
  </svg>
}
