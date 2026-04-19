import { z } from 'zod'
import { bodyTypeEnum } from '@/lib/body-type-analysis'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

const DEFAULT_TEXT_MODEL = 'llama-3.3-70b-versatile'

const ResponseSchema = z.object({
  bodyType: z.preprocess((v) => (typeof v === 'string' ? v.toLowerCase().trim().replace(/\s+/g, '-').replace(/_/g, '-') : v), bodyTypeEnum),
  explanation: z.string().min(1),
  stylingRecommendation: z.string().min(1),
})

export type MeasurementGroqResult = z.infer<typeof ResponseSchema>

export async function classifyBodyFromMeasurements(options: {
  apiKey: string
  modelId: string
  bust: number
  waist: number
  hips: number
  height: number
}): Promise<MeasurementGroqResult> {
  const { apiKey, modelId, bust, waist, hips, height } = options

  const system = `You are VORA's expert fashion fit analyst. Given only numeric body measurements in centimeters, infer the closest fashion body-type label and brief copy.

bodyType must be exactly one of: hourglass, rectangle, pear, apple, inverted-triangle

Use shoulder/bust/waist/hip ratios implied by bust vs waist vs hips (shoulders are not measured—infer conservatively from bust and overall balance).

Respond with JSON only, keys: bodyType, explanation, stylingRecommendation
- explanation: 2 short sentences, warm tone, about their silhouette (no medical claims).
- stylingRecommendation: one concise paragraph of actionable styling advice.`

  const user = `Measurements (cm):
Bust: ${bust}
Waist: ${waist}
Hips: ${hips}
Height: ${height}

Classify bodyType and write explanation and stylingRecommendation as specified.`

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
      temperature: 0.25,
      max_tokens: 500,
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

  const parsed = ResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Groq JSON invalid: ${parsed.error.message}`)
  }
  return parsed.data
}

export function defaultMeasurementsModel(): string {
  return process.env.GROQ_MEASUREMENTS_MODEL?.trim() || DEFAULT_TEXT_MODEL
}
