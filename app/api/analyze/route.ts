import { type BodyAnalysis, buildAnalysisFromBodyType } from '@/lib/body-type-analysis'
import { classifyBodyWithGroq } from '@/lib/groq-classify'
import { classifyFromVisualEvidence, lowerConfidence, type Confidence } from '@/lib/body-type-rules'
import { resolveGroqApiKey } from '@/lib/groq-env'

export type { BodyAnalysis } from '@/lib/body-type-analysis'

export const runtime = 'nodejs'

const DEFAULT_GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

/** Allow time for Groq vision on cold starts (e.g. Vercel). */
export const maxDuration = 120

export async function GET() {
  const key = resolveGroqApiKey()
  return Response.json({
    ok: true,
    groqApiKeyPresent: Boolean(key),
    runtime: 'nodejs',
    modelDefault: DEFAULT_GROQ_VISION_MODEL,
    hint: key
      ? null
      : 'Set GROQ_API_KEY in Vercel → Settings → Environment Variables (Production + Preview), redeploy, then POST /api/analyze with photos.',
  })
}

export async function POST(req: Request) {
  try {
    const apiKey = resolveGroqApiKey()
    if (!apiKey) {
      return Response.json(
        {
          error: 'Groq is not configured.',
          detail:
            'Set GROQ_API_KEY in Vercel (or .env.local). Optional alias: GROQ_KEY. Redeploy after saving.',
        },
        { status: 503 }
      )
    }

    const modelId =
      process.env.GROQ_MODEL?.trim() || process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_GROQ_VISION_MODEL

    const formData = await req.formData()
    const images: { mimeType: string; base64: string }[] = []

    for (let i = 0; i < 3; i++) {
      const file = formData.get(`photo_${i}`) as File | null
      if (file) {
        const bytes = await file.arrayBuffer()
        const mimeType = file.type || 'image/jpeg'
        const base64 = Buffer.from(bytes).toString('base64')
        images.push({ mimeType, base64 })
      }
    }

    if (images.length === 0) {
      return Response.json({ error: 'No images provided' }, { status: 400 })
    }

    const classification = await classifyBodyWithGroq({
      apiKey,
      modelId,
      images,
    })

    if (!classification.isValidInput) {
      return Response.json(
        {
          error: 'Invalid photo input.',
          detail: classification.photoGuidance ?? 'Please upload clearer full-body photos.',
          inputIssues: classification.inputIssues,
        },
        { status: 422 }
      )
    }

    // Body type is decided deterministically from the model's visual evidence
    // (same rule engine as measurements). The model's own label is only a
    // fallback when the evidence is too unclear to map.
    const evidenceDecision = classifyFromVisualEvidence(classification.visualEvidence)
    const bodyType = evidenceDecision.bodyType ?? classification.bodyType ?? 'rectangle'

    // Be conservative: never report higher confidence than either source.
    const modelConfidence = (classification.confidence ?? 'low') as Confidence
    const confidence: Confidence = evidenceDecision.bodyType
      ? lowerConfidence(evidenceDecision.confidence, modelConfidence)
      : 'low'

    const analysis: BodyAnalysis = {
      ...buildAnalysisFromBodyType(bodyType, confidence),
      analysisSource: 'photo',
    }

    return Response.json({ analysis })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[vora] Analysis error:', msg)
    return Response.json(
      { error: 'Analysis failed. Please try again.', detail: msg },
      { status: 500 }
    )
  }
}
