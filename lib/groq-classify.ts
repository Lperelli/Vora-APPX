import {
  AiBodyClassificationGroqSchema,
  type AiBodyClassification,
} from '@/lib/body-type-analysis'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM = `You are VORA's vision classifier. Look at the photo(s) and choose exactly ONE bodyType slug:
hourglass | rectangle | pear | apple | inverted-triangle

Definitions:
- hourglass: bust and hips roughly balanced, waist clearly narrower
- rectangle: shoulders, waist, hips similar width; straight silhouette
- pear: hips/thighs wider than shoulders; more volume below the waist
- apple: fuller midsection relative to hips
- inverted-triangle: shoulders/bust wider than hips

Also set confidence to exactly one of: high | medium | low
(high = clear full-body view; low = unclear but still pick best bodyType)

Respond with JSON only, no markdown, no extra keys.`

const USER_TAIL =
  'Return one JSON object with keys "bodyType" and "confidence" only. Values must be lowercase slugs as specified.'

export type GroqImagePart = { mimeType: string; base64: string }

export async function classifyBodyWithGroq(options: {
  apiKey: string
  modelId: string
  images: GroqImagePart[]
}): Promise<AiBodyClassification> {
  const { apiKey, modelId, images } = options
  if (images.length === 0) {
    throw new Error('classifyBodyWithGroq: no images')
  }

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = []

  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    })
  }
  content.push({ type: 'text', text: USER_TAIL })

  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content },
      ],
      temperature: 0.2,
      max_tokens: 128,
      response_format: { type: 'json_object' },
    }),
  })

  const rawText = await res.text()
  if (!res.ok) {
    throw new Error(`Groq API ${res.status}: ${rawText.slice(0, 800)}`)
  }

  let completion: {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  }
  try {
    completion = JSON.parse(rawText) as typeof completion
  } catch {
    throw new Error(`Groq response not JSON: ${rawText.slice(0, 300)}`)
  }

  if (completion.error?.message) {
    throw new Error(`Groq error: ${completion.error.message}`)
  }

  const rawContent = completion.choices?.[0]?.message?.content
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Groq returned no message content')
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawContent)
  } catch {
    throw new Error(`Groq content was not valid JSON: ${rawContent.slice(0, 400)}`)
  }

  const parsed = AiBodyClassificationGroqSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error(`Classification schema mismatch: ${parsed.error.message}`)
  }
  return parsed.data
}
