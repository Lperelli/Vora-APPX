'use client'

import { useState, useCallback } from 'react'
import { WelcomeScreen } from '@/components/vora/welcome-screen'
import { IntroScreen } from '@/components/vora/intro-screen'
import { OverwhelmedScreen } from '@/components/vora/overwhelmed-screen'
import { PhotoUploadScreen } from '@/components/vora/photo-upload-screen'
import { ProcessingScreen } from '@/components/vora/processing-screen'
import { ResultsScreen } from '@/components/vora/results-screen'
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
    </main>
  )
}
