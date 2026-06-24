'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { IntroScreen } from '@/components/vora/intro-screen'
import { PhotoUploadScreen } from '@/components/vora/photo-upload-screen'
import { MeasurementsQuizScreen } from '@/components/vora/measurements-quiz-screen'
import { ProcessingScreen } from '@/components/vora/processing-screen'
import { ResultsScreen } from '@/components/vora/results-screen'
import { StyleRecommendationsScreen } from '@/components/vora/style-recommendations-screen'
import { EmailGateScreen } from '@/components/vora/email-gate-screen'
import { PhotoFallbackScreen, type PhotoIssue } from '@/components/vora/photo-fallback-screen'
import { VoraLogo } from '@/components/vora/vora-logo'
import { type BodyAnalysis, buildAnalysisFromBodyType } from '@/lib/body-type-analysis'
import { analyzeMeasurements, buildAnalysisFromClassification, type ManualMeasurements } from '@/lib/analyze'
import { classifyBodyType } from '@/lib/body-classifier'
import { measureFromImage } from '@/lib/photo-flow'

type Step =
  | 'intro'      // Entry screen: "WE KNOW ONLINE FITTING IS A STRUGGLE"
  | 'measurements' // Measurements quiz (Enter Measurements)
  | 'upload'     // Screen 4: photo upload
  | 'processing' // Screen 5: analyzing animation
  | 'photoFallback' // Photo unusable / low confidence → retry or manual
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
  const [photoIssue, setPhotoIssue] = useState<PhotoIssue | null>(null)
  const [emailProvided, setEmailProvided] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  // Show the loading splash from the very first paint so it covers the page,
  // then reveal the app — instead of flashing the page first.
  const [showIntro, setShowIntro] = useState(true)

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
    async (files: File[]) => {
      setProcessingReturnStep('upload')
      setStep('processing')
      setIsAnalysisComplete(false)
      setPhotoIssue(null)

      const started = now()
      try {
        let widths: NonNullable<Awaited<ReturnType<typeof measureFromImage>>['widths']> | null = null
        let lastReason: PhotoIssue = 'no_body'

        for (const file of files) {
          const measured = await measureFromImage(file)
          if (measured.ok && measured.widths) {
            widths = measured.widths
            break
          }
          if (measured.reason) lastReason = measured.reason
        }

        await waitRemaining(started)

        if (!widths) {
          setPhotoIssue(lastReason)
          setStep('photoFallback')
          return
        }

        const result = classifyBodyType(widths)
        if (result.confidence === 'low') {
          // Never present a low-confidence guess as exact (spec §5).
          setPhotoIssue('low_confidence')
          setStep('photoFallback')
          return
        }

        setAnalysisResult(buildAnalysisFromClassification(result, 'photo'))
        setIsAnalysisComplete(true)
      } catch (error) {
        console.error('[vora] photo analysis failed:', error instanceof Error ? error.message : error)
        await waitRemaining(started)
        setPhotoIssue('load_failed')
        setStep('photoFallback')
      }
    },
    [waitRemaining]
  )

  // ── Manual flow: same classifier, fully deterministic ─────────────────────
  const handleMeasurementAnalyze = useCallback(
    async (payload: ManualMeasurements) => {
      setProcessingReturnStep('measurements')
      setStep('processing')
      setIsAnalysisComplete(false)
      setPhotoIssue(null)

      const started = now()
      try {
        const analysis = analyzeMeasurements(payload)
        await waitRemaining(started)
        setAnalysisResult(analysis)
        setIsAnalysisComplete(true)
      } catch (error) {
        console.error('[vora] measurement analysis failed:', error instanceof Error ? error.message : error)
        await waitRemaining(started)
        setAnalysisResult({ ...buildAnalysisFromBodyType('rectangle', 'low'), analysisSource: 'measurement' })
        setIsAnalysisComplete(true)
      }
    },
    [waitRemaining]
  )

  const handleRedo = useCallback(() => {
    setStep('intro')
    setUploadBackStep('intro')
    setAnalysisResult(null)
    setIsAnalysisComplete(false)
    setPhotoIssue(null)
  }, [])

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
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14, filter: 'blur(14px)' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10, filter: 'blur(14px)' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen"
          >
            {step === 'intro' && (
              <IntroScreen
                onBack={() => {
                  if (typeof window !== 'undefined') window.history.back()
                }}
                onUploadPhotos={() => goToUpload('intro')}
                onEnterMeasurements={() => setStep('measurements')}
              />
            )}

            {step === 'measurements' && (
              <MeasurementsQuizScreen
                onBack={() => setStep('intro')}
                onSubmitMeasurements={handleMeasurementAnalyze}
              />
            )}

            {step === 'upload' && (
              <PhotoUploadScreen onSubmit={handleAnalyze} onBack={() => setStep(uploadBackStep)} />
            )}

            {step === 'processing' && (
              <ProcessingScreen
                isComplete={isAnalysisComplete}
                source={processingReturnStep === 'measurements' ? 'measurement' : 'photo'}
                onReturn={() => {
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
                onRetryPhoto={() => setStep('upload')}
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
                onBack={() => setStep(processingReturnStep)}
              />
            )}

            {step === 'results' && analysisResult && (
              <ResultsScreen
                analysis={analysisResult}
                onRedo={handleRedo}
                onShowRecommendations={() => setStep('recommendations')}
              />
            )}

            {step === 'recommendations' && analysisResult && (
              <StyleRecommendationsScreen
                analysis={analysisResult}
                onBack={() => setStep('results')}
                onRedo={handleRedo}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
    </main>
  )
}
