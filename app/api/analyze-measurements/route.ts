import { z } from 'zod'
import { buildAnalysisFromBodyType, type BodyAnalysis } from '@/lib/body-type-analysis'
import { classifyFromMeasurements } from '@/lib/body-type-rules'
import { generateMeasurementStyling, defaultMeasurementsModel } from '@/lib/groq-measurements'
import { resolveGroqApiKey } from '@/lib/groq-env'

export const runtime = 'nodejs'
export const maxDuration = 60

const InputSchema = z.object({
  bustCm: z.coerce.number().positive().max(250),
  waistCm: z.coerce.number().positive().max(300),
  hipsCm: z.coerce.number().positive().max(300),
  // Optional — collected for sizing / accuracy, not required to classify.
  heightCm: z.coerce.number().positive().max(260).optional(),
  shouldersCm: z.coerce.number().positive().max(250).optional(),
})

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as unknown
    const parsed = InputSchema.safeParse(json)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid measurements', detail: parsed.error.flatten() }, { status: 400 })
    }

    const { bustCm, waistCm, hipsCm, heightCm, shouldersCm } = parsed.data

    // 1) Body type is decided deterministically — exact and reproducible.
    const decision = classifyFromMeasurements({ bustCm, waistCm, hipsCm, heightCm, shouldersCm })

    // 2) Start from curated preset copy so a result is always available.
    const analysis: BodyAnalysis = {
      ...buildAnalysisFromBodyType(decision.bodyType, decision.confidence),
      analysisSource: 'measurement',
    }

    // 3) Best-effort: let Groq personalize the copy for the decided type.
    //    The body type never changes if this fails.
    const apiKey = resolveGroqApiKey()
    if (apiKey) {
      try {
        const copy = await generateMeasurementStyling({
          apiKey,
          modelId: defaultMeasurementsModel(),
          bodyType: decision.bodyType,
          bodyTypeLabel: analysis.bodyTypeLabel,
          confidence: decision.confidence,
          ratios: decision.ratios,
          measurements: { bustCm, waistCm, hipsCm, shouldersCm },
        })
        analysis.silhouetteDescription = copy.explanation
        analysis.measurementAiStyling = copy.stylingRecommendation
      } catch (copyError) {
        console.warn('[vora] measurement copy fallback:', copyError instanceof Error ? copyError.message : copyError)
      }
    }

    return Response.json({ analysis })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[vora] analyze-measurements:', msg)
    return Response.json({ error: 'Analysis failed.', detail: msg }, { status: 500 })
  }
}
