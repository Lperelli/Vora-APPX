'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { WelcomeScreen } from '@/components/vora/welcome-screen'
import { IntroScreen } from '@/components/vora/intro-screen'
import { OverwhelmedScreen } from '@/components/vora/overwhelmed-screen'
import { PhotoUploadScreen } from '@/components/vora/photo-upload-screen'
import { ProcessingScreen } from '@/components/vora/processing-screen'
import { ResultsScreen } from '@/components/vora/results-screen'
import { VoraLogo } from '@/components/vora/vora-logo'
import type { BodyAnalysis } from '@/app/api/analyze/route'

type Step =
  | 'welcome'    // Screen 1: photo grid + "OVERWHELMED?" modal
  | 'intro'      // Screen 2: "WE KNOW ONLINE FITTING IS A STRUGGLE"
  | 'overwhelmed' // Screen 3: "OVERWHELMED?" standalone
  | 'upload'     // Screen 4: photo upload
  | 'processing' // Screen 5: analyzing animation
  | 'results'    // Screen 6: body type results

export default function VoraApp() {
  const [step, setStep] = useState<Step>('welcome')
  const [analysisResult, setAnalysisResult] = useState<BodyAnalysis | null>(null)
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion) return
    try {
      const key = 'vora_intro_seen_v1'
      const alreadySeen = sessionStorage.getItem(key) === '1'
      if (!alreadySeen) {
        setShowIntro(true)
        sessionStorage.setItem(key, '1')
        const t = window.setTimeout(() => setShowIntro(false), 1350)
        return () => window.clearTimeout(t)
      }
    } catch {
      // If storage is unavailable, just skip the intro.
      setShowIntro(false)
    }
  }, [prefersReducedMotion])

  const introDurationMs = 1350
  const introProgressTransition = useMemo(
    () => ({ duration: introDurationMs / 1000, ease: [0.16, 1, 0.3, 1] as const }),
    [introDurationMs]
  )

  const handleAnalyze = useCallback(async (files: File[]) => {
    setStep('processing')
    setIsAnalysisComplete(false)

    try {
      const formData = new FormData()
      files.forEach((file, i) => {
        formData.append(`photo_${i}`, file)
      })

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const data = await response.json()
      setAnalysisResult(data.analysis)
      setIsAnalysisComplete(true)
    } catch (error) {
      console.error('[vora] Analysis failed:', error)
      // Show fallback result on error
      setAnalysisResult({
        bodyType: 'rectangle',
        bodyTypeLabel: 'Rectangle',
        silhouetteDescription:
          'Your silhouette is naturally straight and balanced, with subtle transitions between shoulders, waist, and hips. This gives you the freedom to create shape through styling.',
        whatWorksForYou: [
          'Create the illusion of a waist with belted styles',
          'Add dimension through structure or layering',
          'Play with volume (top OR bottom) to shape your silhouette',
          'Use belts or cuts to break the straight line',
          'Wrap dresses and peplum tops work beautifully',
        ],
        whatToAvoid: [
          'Boxy silhouettes that add bulk without definition',
          'Shapeless shift dresses worn plain',
          'Too much volume top and bottom simultaneously',
        ],
        celebrities: [
          { name: 'Keira Knightley', reason: 'Classic rectangle with elegant styling' },
          { name: 'Natalie Portman', reason: 'Lean silhouette, uses waist definition' },
          { name: 'Zendaya', reason: 'Creates curves through clever styling' },
          { name: 'Cameron Diaz', reason: 'Athletic build with straight lines' },
        ],
        styleRecommendations: [
          { category: 'Tops', tip: 'Opt for peplum, ruffled, or wrap tops to create waist definition.' },
          { category: 'Bottoms', tip: 'A-line skirts and wide-leg trousers add hip volume beautifully.' },
          { category: 'Dresses', tip: 'Wrap dresses and fit-and-flare silhouettes are your best friends.' },
          { category: 'Outerwear', tip: 'Belted coats and blazers instantly define your silhouette.' },
          { category: 'Accessories', tip: 'Statement belts cinch the waist and add instant shape.' },
        ],
        confidence: 'high',
      })
      setIsAnalysisComplete(true)
    }
  }, [])

  const handleRedo = useCallback(() => {
    setStep('welcome')
    setAnalysisResult(null)
    setIsAnalysisComplete(false)
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
              {/* Soft vignette + glow */}
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
                  <VoraLogo />

                  <div className="w-full max-w-[260px]">
                    {/* Track */}
                    <div className="relative h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      {/* Shimmer */}
                      <motion.div
                        className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,oklch(0.96_0_0/0.10)_35%,transparent_70%)]"
                        initial={{ x: '-60%' }}
                        animate={{ x: '120%' }}
                        transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
                      />
                      {/* Progress fill */}
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
            {step === 'welcome' && (
              <WelcomeScreen
                onStart={() => setStep('intro')}
                onSkip={() => setStep('upload')}
              />
            )}

            {step === 'intro' && (
              <IntroScreen
                onUploadPhotos={() => setStep('upload')}
                onEnterMeasurements={() => setStep('overwhelmed')}
              />
            )}

            {step === 'overwhelmed' && (
              <OverwhelmedScreen
                onUploadPhotos={() => setStep('upload')}
                onFillQuiz={() => setStep('upload')}
              />
            )}

            {step === 'upload' && (
              <PhotoUploadScreen
                onSubmit={handleAnalyze}
                onBack={() => setStep('intro')}
              />
            )}

            {step === 'processing' && (
              <ProcessingScreen
                isComplete={isAnalysisComplete}
                onComplete={() => {
                  if (analysisResult) setStep('results')
                }}
              />
            )}

            {step === 'results' && analysisResult && (
              <ResultsScreen
                analysis={analysisResult}
                onRedo={handleRedo}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
    </main>
  )
}
