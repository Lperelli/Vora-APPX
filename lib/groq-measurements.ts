import { z } from 'zod'
import type { BodyTypeId } from '@/lib/body-type-analysis'
import type { Confidence, DetectedRatios } from '@/lib/body-type-rules'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

const DEFAULT_TEXT_MODEL = 'llama-3.3-70b-versatile'

/**
 * The body type is decided deterministically by the rule engine
 * (`classifyFromMeasurements`). Groq is used ONLY to write warm, personalized
 * styling copy for the already-decided type — it never reclassifies.
 */
const CopySchema = z.object({
  explanation: z.string().min(1),
  stylingRecommendation: z.string().min(1),
})

export type MeasurementCopy = z.infer<typeof CopySchema>

export async function generateMeasurementStyling(options: {
  apiKey: string
  modelId: string
  bodyType: BodyTypeId
  bodyTypeLabel: string
  confidence: Confidence
  ratios: DetectedRatios
  measurements: { bustCm: number; waistCm: number; hipsCm: number; shouldersCm?: number | null }
}): Promise<MeasurementCopy> {
  const { apiKey, modelId, bodyType, bodyTypeLabel, confidence, ratios } = options

  const system = `
You are VORA's fashion stylist writing copy for womenswear.

The body type has ALREADY been determined by VORA's measurement engine. Your ONLY job is to write warm, affirming, styling-focused copy for that exact body type. Do NOT reclassify, question, or change the body type. Do NOT mention numbers, ratios, weight, BMI, age, ethnicity, attractiveness, health, or medical ideas.

Write in a confident, encouraging, editorial tone. Speak directly to "you".

OUTPUT:
Return ONLY valid JSON. No markdown, no prose, no comments, no trailing commas.

Schema:
{
  "explanation": string,            // exactly 2 short warm sentences describing this silhouette
  "stylingRecommendation": string   // one concise paragraph, 3-5 sentences, of practical styling guidance
}
`.trim()

  const user = `Body type (final, do not change): ${bodyType} (${bodyTypeLabel})
Confidence: ${confidence}
Detected proportions (context only, never mention numbers): waist/hip ${ratios.waistToHip}, hip/upper ${ratios.hipToUpper}, upper/hip ${ratios.upperToHip}

Write the explanation and stylingRecommendation as JSON only.`

  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.55,
      max_tokens: 500,
      top_p: 0.9,
      response_format: { type: 'json_object' },
    }),
  })

  const rawText = await res.text()
  if (!res.ok) {
    throw new Error(`Groq API ${res.status}: ${rawText.slice(0, 800)}`)
  }

  const completion = JSON.parse(rawText) as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  }

  if (completion.error?.message) {
    throw new Error(`Groq error: ${completion.error.message}`)
  }

  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned empty content')

  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    throw new Error(`Groq returned non-JSON: ${content.slice(0, 400)}`)
  }

  const parsed = CopySchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Groq copy JSON invalid: ${parsed.error.message}`)
  }
  return parsed.data
}

export function defaultMeasurementsModel(): string {
  return process.env.GROQ_MEASUREMENTS_MODEL?.trim() || DEFAULT_TEXT_MODEL
}
