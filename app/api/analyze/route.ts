import { type BodyAnalysis, buildAnalysisFromBodyType } from '@/lib/body-type-analysis'
import { classifyBodyWithGroq } from '@/lib/groq-classify'
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

    const analysis: BodyAnalysis = buildAnalysisFromBodyType(
      classification.bodyType,
      classification.confidence
    )

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
