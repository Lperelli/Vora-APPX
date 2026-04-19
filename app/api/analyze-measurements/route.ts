import { z } from 'zod'
import { buildAnalysisFromBodyType, type BodyAnalysis } from '@/lib/body-type-analysis'
import { classifyBodyFromMeasurements, defaultMeasurementsModel } from '@/lib/groq-measurements'
import { resolveGroqApiKey } from '@/lib/groq-env'

export const runtime = 'nodejs'
export const maxDuration = 60

const InputSchema = z.object({
  bust: z.coerce.number().positive().max(300),
  waist: z.coerce.number().positive().max(300),
  hips: z.coerce.number().positive().max(300),
  height: z.coerce.number().positive().max(260),
})

export async function POST(req: Request) {
  try {
    const apiKey = resolveGroqApiKey()
    if (!apiKey) {
      return Response.json(
        {
          error: 'Groq is not configured.',
          detail: 'Set GROQ_API_KEY (or GROQ_KEY) in environment variables.',
        },
        { status: 503 }
      )
    }

    const json = (await req.json()) as unknown
    const parsed = InputSchema.safeParse(json)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid measurements', detail: parsed.error.flatten() }, { status: 400 })
    }

    const { bust, waist, hips, height } = parsed.data
    const modelId = defaultMeasurementsModel()

    const ai = await classifyBodyFromMeasurements({
      apiKey,
      modelId,
      bust,
      waist,
      hips,
      height,
    })

    const base = buildAnalysisFromBodyType(ai.bodyType, 'high')
    const analysis: BodyAnalysis = {
      ...base,
      silhouetteDescription: ai.explanation,
      measurementAiStyling: ai.stylingRecommendation,
      analysisSource: 'measurement',
    }

    return Response.json({ analysis })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[vora] analyze-measurements:', msg)
    return Response.json({ error: 'Analysis failed.', detail: msg }, { status: 500 })
  }
}
