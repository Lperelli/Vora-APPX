'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { IntroScreen } from '@/components/vora/intro-screen'
import { LiveCameraScreen } from '@/components/vora/live-camera-screen'
import { assessPhotoSession } from '@/lib/photo-session'
import { PhotoReviewScreen } from '@/components/vora/photo-review-screen'
import { PhotoUploadScreen } from '@/components/vora/photo-upload-screen'
import { MeasurementsQuizScreen } from '@/components/vora/measurements-quiz-screen'
import { ProcessingScreen } from '@/components/vora/processing-screen'
import { ResultsScreen } from '@/components/vora/results-screen'
import { StyleRecommendationsScreen } from '@/components/vora/style-recommendations-screen'
import { EmailGateScreen } from '@/components/vora/email-gate-screen'
import { PhotoFallbackScreen, PHOTO_ISSUE_MESSAGES, type PhotoIssue } from '@/components/vora/photo-fallback-screen'
import { VoraLogo } from '@/components/vora/vora-logo'
import { type BodyAnalysis, buildAnalysisFromBodyType } from '@/lib/body-type-analysis'
import { analyzeMeasurements, buildAnalysisFromClassification, type ManualMeasurements } from '@/lib/analyze'
import { createPhotoAnalyzer, type PhotoMeasureResult } from '@/lib/photo-flow'
import { decodeProfile, encodeProfile, PROFILE_SESSION_KEY } from '@/lib/profile-session'

type Step =
  | 'intro'      // Entry screen: "WE KNOW ONLINE FITTING IS A STRUGGLE"
  | 'measurements' // Measurements quiz (Enter Measurements)
  | 'camera'
  | 'upload'     // Screen 4: photo upload
  | 'processing' // Screen 5: analyzing animation
  | 'photoReview'
  | 'photoFallback' // Photo unusable → retry or manual
  | 'emailGate'  // Capture email before unlocking results
  | 'results'    // Screen 6: body type results
  | 'recommendations' // Screen 7: editorial style picks (Figma 327:423)

const MIN_PROCESSING_MS = 2200

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export default function VoraApp() {
  const [step, setStep] = useState<Step>('intro')
  const [uploadBackStep, setUploadBackStep] = useState<Step>('intro')
  const [processingReturnStep, setProcessingReturnStep] = useState<Step>('upload')
  const [analysisResult, setAnalysisResult] = useState<BodyAnalysis | null>(null)
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false)
  const [libraryFiles, setLibraryFiles] = useState<File[]>([])
  const analysisRun = useRef(0)
  const activeAnalyzer = useRef<ReturnType<typeof createPhotoAnalyzer> | null>(null)
  const [photoProgress, setPhotoProgress] = useState<{ completed: number; total: number }>()
  const [photoAssessments, setPhotoAssessments] = useState<Array<{index: number; status: 'used' | 'excluded' | 'conflict'; reason?: string}>>([])
  useEffect(() => () => { analysisRun.current += 1; activeAnalyzer.current?.dispose() }, [])
  const [photoIssue, setPhotoIssue] = useState<PhotoIssue | null>(null)
  const [emailProvided, setEmailProvided] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  // Show the loading splash from the very first paint so it covers the page,
  // then reveal the app — instead of flashing the page first.
  const [showIntro, setShowIntro] = useState(true)

  useEffect(() => {
    try {
      const saved = decodeProfile(sessionStorage.getItem(PROFILE_SESSION_KEY))
      if (saved) {
        setAnalysisResult(saved.analysis)
        setEmailProvided(true)
        setStep(saved.view)
      } else sessionStorage.removeItem(PROFILE_SESSION_KEY)
    } catch { /* A restricted browser can still complete the quiz. */ }
  }, [])

  useEffect(() => {
    if (!analysisResult || (step !== 'results' && step !== 'recommendations')) return
    try { sessionStorage.setItem(PROFILE_SESSION_KEY, encodeProfile(analysisResult, step)) } catch { /* optional session continuity */ }
    setLibraryFiles([])
  }, [analysisResult, step])

  useEffect(() => { window.scrollTo(0, 0) }, [step])

  const introDurationMs = 1350

  useEffect(() => {
    let alreadySeen = false
    try {
      alreadySeen = sessionStorage.getItem('vora_intro_seen_v1') === '1'
    } catch {
      /* storage unavailable */
    }
    // Repeat visits within the session, or reduced-motion users, skip the splash.
    if (prefersReducedMotion || alreadySeen) {
      setShowIntro(false)
      return
    }
    try {
      sessionStorage.setItem('vora_intro_seen_v1', '1')
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setShowIntro(false), introDurationMs)
    return () => window.clearTimeout(t)
  }, [prefersReducedMotion])

  const introProgressTransition = useMemo(
    () => ({ duration: introDurationMs / 1000, ease: [0.16, 1, 0.3, 1] as const }),
    [introDurationMs]
  )

  const waitRemaining = useCallback(async (started: number) => {
    const elapsed = now() - started
    if (elapsed < MIN_PROCESSING_MS) {
      await new Promise((r) => setTimeout(r, MIN_PROCESSING_MS - elapsed))
    }
  }, [])

  // ── Photo flow: 100% client-side (MediaPipe), nothing uploaded ────────────
  const handleAnalyze = useCallback(
    async (files: File[], source: 'camera' | 'library') => {
      if (files.length !== (source === 'camera' ? 1 : 3)) return
      const run = ++analysisRun.current
      activeAnalyzer.current?.dispose()
      setProcessingReturnStep(source === 'camera' ? 'camera' : 'upload')
      setStep('processing')
      setIsAnalysisComplete(false)
      setAnalysisResult(null)
      setPhotoIssue(null)
      setPhotoAssessments([])
      setPhotoProgress({ completed: 0, total: files.length })

      const started = now()
      const photoAnalyzer = createPhotoAnalyzer()
      activeAnalyzer.current = photoAnalyzer
      try {
        const measuredPhotos: Array<{index: number; measured: PhotoMeasureResult}> = []
        for (let index = 0; index < files.length; index++) {
          const measured = await photoAnalyzer.measure(files[index])
          if (run !== analysisRun.current) return
          measuredPhotos.push({ index, measured })
          setPhotoProgress({ completed: index + 1, total: files.length })
          // Initialization failure affects the whole session; do not download the model three times.
          if (measured.reason === 'load_failed') {
            for (let remaining = index + 1; remaining < files.length; remaining++) {
              measuredPhotos.push({ index: remaining, measured })
            }
            break
          }
        }
        await waitRemaining(started)
        if (run !== analysisRun.current) return

        const candidates = measuredPhotos.flatMap(({ index, measured }) =>
          measured.ok && measured.widths ? [{ index, widths: measured.widths }] : [])
        const session = assessPhotoSession(candidates, source)
        const assessments = measuredPhotos.map(({index, measured}) => ({
          index,
          status: (!measured.ok ? 'excluded' : session.ok ? session.usedIndices.includes(index) ? 'used' : 'excluded' : 'conflict') as 'used' | 'excluded' | 'conflict',
          reason: measured.ok
            ? session.ok && session.usedIndices.includes(index) ? 'Clear enough for an estimated style profile.' : 'This view suggests different proportions. Try a straight-on, standing photo.'
            : PHOTO_ISSUE_MESSAGES[measured.reason ?? 'no_body'],
        }))
        if (source === 'library') setPhotoAssessments(assessments)
        if (session.ok) {
          setAnalysisResult({ ...buildAnalysisFromClassification(session.classification, 'photo'), photoCount: session.usedPhotoCount })
        }
        if (source === 'library') {
          setStep('photoReview')
        } else if (session.ok) {
          setIsAnalysisComplete(true)
        } else {
          setPhotoIssue(measuredPhotos[0]?.measured.reason ?? 'inconsistent_photos')
          setStep('photoFallback')
        }
      } catch (error) {
        if (run !== analysisRun.current) return
        console.error('[vora] photo analysis failed:', error instanceof Error ? error.message : error)
        await waitRemaining(started)
        if (run !== analysisRun.current) return
        setPhotoIssue('load_failed')
        setStep('photoFallback')
      } finally {
        photoAnalyzer.dispose()
        if (activeAnalyzer.current === photoAnalyzer) activeAnalyzer.current = null
      }
    },
    [waitRemaining]
  )

  // ── Manual flow: same classifier, fully deterministic ─────────────────────
  const handleMeasurementAnalyze = useCallback(
    async (payload: ManualMeasurements) => {
      const run = ++analysisRun.current
      setProcessingReturnStep('measurements')
      setStep('processing')
      setIsAnalysisComplete(false)
      setPhotoIssue(null)

      const started = now()
      try {
        const analysis = analyzeMeasurements(payload)
        await waitRemaining(started)
        if (run !== analysisRun.current) return
        setAnalysisResult(analysis)
        setIsAnalysisComplete(true)
      } catch (error) {
        console.error('[vora] measurement analysis failed:', error instanceof Error ? error.message : error)
        await waitRemaining(started)
        if (run !== analysisRun.current) return
        setAnalysisResult({ ...buildAnalysisFromBodyType('rectangle', 'low'), analysisSource: 'measurement' })
        setIsAnalysisComplete(true)
      }
    },
    [waitRemaining]
  )

  const goToUpload = useCallback((returnStep: Step) => {
    setUploadBackStep(returnStep)
    setStep('upload')
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {showIntro && !prefersReducedMotion && (
            <motion.div
              className="fixed inset-0 z-[100] bg-background"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
            >
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_35%,oklch(0.22_0_0/0.55)_0%,transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_55%,oklch(0.16_0_0/0.7)_0%,transparent_70%)]" />
              </div>

              <div className="relative h-full w-full flex flex-col items-center justify-center px-6">
                <motion.div
                  initial={{ opacity: 0, y: 16, filter: 'blur(18px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center gap-6"
                >
                  <VoraLogo priority className="h-10 w-auto sm:h-12 md:h-14" />

                  <div className="w-full max-w-[260px]">
                    <div className="relative h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,oklch(0.96_0_0/0.10)_35%,transparent_70%)]"
                        initial={{ x: '-60%' }}
                        animate={{ x: '120%' }}
                        transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
                      />
                      <motion.div
                        className="absolute left-0 top-0 h-full rounded-full bg-foreground/30"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={introProgressTransition}
                      />
                    </div>

                    <motion.p
                      className="mt-4 text-[10px] tracking-[0.3em] text-muted-foreground uppercase text-center"
                      initial={{ opacity: 0, y: 6, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    >
                      Preparing your experience
                    </motion.p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen"
          >
            {step === 'intro' && (
              <IntroScreen
                onBack={() => { window.location.href = '/' }}
                onUploadPhotos={() => goToUpload('intro')}
                onEnterMeasurements={() => setStep('measurements')}
                onTakePhoto={() => setStep('camera')}
              />
            )}

            {step === 'measurements' && (
              <MeasurementsQuizScreen
                onBack={() => setStep('intro')}
                onSubmitMeasurements={handleMeasurementAnalyze}
              />
            )}

            {step === 'camera' && <LiveCameraScreen onSubmit={files => void handleAnalyze(files, 'camera')} onBack={() => setStep('intro')} onUseLibrary={() => goToUpload('intro')} onUseMeasurements={() => setStep('measurements')} />}

            {step === 'upload' && (
              <PhotoUploadScreen files={libraryFiles} feedback={photoAssessments.map(item => ({ index: item.index, message: item.reason ?? '' }))} onFilesChange={files => {
                setPhotoAssessments(current => current.filter(item => files[item.index] === libraryFiles[item.index]))
                setLibraryFiles(files)
              }} onTakePhoto={() => setStep('camera')} onSubmit={files => void handleAnalyze(files, 'library')} onBack={() => setStep(uploadBackStep)} />
            )}

            {step === 'photoReview' && (
              <PhotoReviewScreen
                files={libraryFiles}
                assessments={photoAssessments}
                usableCount={analysisResult?.photoCount ?? 0}
                canContinue={Boolean(analysisResult)}
                onContinue={() => { if (analysisResult) setStep(emailProvided ? 'results' : 'emailGate') }}
                onRetry={() => setStep('upload')}
                onBack={() => setStep('upload')}
                onEnterMeasurements={() => setStep('measurements')}
              />
            )}

            {step === 'processing' && (
              <ProcessingScreen
                isComplete={isAnalysisComplete}
                photoProgress={photoProgress}
                source={processingReturnStep === 'measurements' ? 'measurement' : 'photo'}
                onReturn={() => {
                  analysisRun.current += 1
                  activeAnalyzer.current?.dispose()
                  activeAnalyzer.current = null
                  setIsAnalysisComplete(false)
                  setStep(processingReturnStep)
                }}
                onComplete={() => {
                  if (analysisResult) setStep(emailProvided ? 'results' : 'emailGate')
                }}
              />
            )}

            {step === 'photoFallback' && photoIssue && (
              <PhotoFallbackScreen
                issue={photoIssue}
                onRetryPhoto={() => setStep(processingReturnStep)}
                onEnterMeasurements={() => setStep('measurements')}
                onBack={() => setStep('intro')}
              />
            )}

            {step === 'emailGate' && analysisResult && (
              <EmailGateScreen
                onSubmit={() => {
                  setEmailProvided(true)
                  setStep('results')
                }}
                onBack={() => setStep(processingReturnStep === 'upload' && photoAssessments.length ? 'photoReview' : processingReturnStep)}
              />
            )}

            {step === 'results' && analysisResult && (
              <ResultsScreen
                analysis={analysisResult}
                onHome={() => { window.location.href = '/' }}
                onShowRecommendations={() => setStep('recommendations')}
              />
            )}

            {step === 'recommendations' && analysisResult && (
              <StyleRecommendationsScreen
                analysis={analysisResult}
                onBack={() => setStep('results')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
    </main>
  )
}
