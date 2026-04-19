import { generateText, Output } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import {
  AiBodyClassificationSchema,
  type BodyAnalysis,
  type BodyTypeId,
  buildAnalysisFromBodyType,
} from '@/lib/body-type-analysis'

export type { BodyAnalysis } from '@/lib/body-type-analysis'

const DEFAULT_GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

/** Allow time for Groq vision + structured output on cold starts (e.g. Vercel). */
export const maxDuration = 120

const SYSTEM_PROMPT = `You are VORA's vision classifier. Your ONLY job is to look at the photo(s) and choose exactly ONE body-type label from this closed list (use the exact slug value for bodyType):

- hourglass — bust and hips roughly balanced, waist clearly narrower; defined curves
- rectangle — shoulders, waist, and hips similar width; straight silhouette
- pear — hips/thighs wider than shoulders; more volume below the waist
- apple — fuller midsection relative to hips; weight carried more around the torso
- inverted-triangle — shoulders/bust noticeably wider than hips; strong upper body

RULES:
- Pick the single closest match. Never refuse or ask questions.
- confidence: "high" if full body and proportions are clear, "medium" if partial or angled, "low" if very unclear — still pick the best label.
- Do NOT invent celebrities, styling tips, or long text. Output ONLY the two fields in the schema.`

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY?.trim()
    if (!apiKey) {
      return Response.json(
        {
          error: 'Groq is not configured.',
          detail: 'Set GROQ_API_KEY in .env.local (see .env.example).',
        },
        { status: 503 }
      )
    }

    const modelId =
      process.env.GROQ_MODEL?.trim() || process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_GROQ_VISION_MODEL

    const formData = await req.formData()
    const imageContents: { type: 'image'; image: Uint8Array; mimeType: string }[] = []

    for (let i = 0; i < 3; i++) {
      const file = formData.get(`photo_${i}`) as File | null
      if (file) {
        const bytes = await file.arrayBuffer()
        const mimeType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
        imageContents.push({ type: 'image', image: new Uint8Array(bytes), mimeType })
      }
    }

    if (imageContents.length === 0) {
      return Response.json({ error: 'No images provided' }, { status: 400 })
    }

    const groq = createGroq({ apiKey })

    const result = await generateText({
      model: groq(modelId),
      experimental_output: Output.object({ schema: AiBodyClassificationSchema }),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: 'Classify this person’s body type for fashion styling. Return only bodyType and confidence per instructions.',
            },
          ],
        },
      ],
    })

    const raw = result.experimental_output
    const parsed = AiBodyClassificationSchema.safeParse(raw)
    const bodyType: BodyTypeId = parsed.success ? parsed.data.bodyType : 'rectangle'
    const confidence = parsed.success ? parsed.data.confidence : 'low'

    const analysis: BodyAnalysis = buildAnalysisFromBodyType(bodyType, confidence)

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
