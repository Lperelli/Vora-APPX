import { z } from 'zod'
import { bodyTypeEnum } from '@/lib/body-type-analysis'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

const DEFAULT_TEXT_MODEL = 'llama-3.3-70b-versatile'

const normalizeSlug = (v: unknown) =>
  typeof v === 'string' ? v.toLowerCase().trim().replace(/\s+/g, '-').replace(/_/g, '-') : v

const ResponseSchema = z.object({
  isValidInput: z.boolean(),
  bodyType: z.preprocess(normalizeSlug, z.union([bodyTypeEnum, z.null()])),
  confidence: z.preprocess(
    (v) => (typeof v === 'string' ? v.toLowerCase().trim() : v),
    z.union([z.enum(['high', 'medium', 'low']), z.null()])
  ),
  explanation: z.union([z.string().min(1), z.null()]),
  stylingRecommendation: z.union([z.string().min(1), z.null()]),
  detectedRatios: z.object({
    upperToHip: z.number().nullable(),
    hipToUpper: z.number().nullable(),
    waistToHip: z.number().nullable(),
  }),
  inputIssues: z.array(z.string().min(1)),
})

export type MeasurementGroqResult = z.infer<typeof ResponseSchema>

export async function classifyBodyFromMeasurements(options: {
  apiKey: string
  modelId: string
  shouldersCm?: number | null
  bustCm?: number | null
  waistCm: number
  hipsCm: number
}): Promise<MeasurementGroqResult> {
  const { apiKey, modelId, shouldersCm, bustCm, waistCm, hipsCm } = options

  const system = `
You are VORA's fashion body proportion classifier for womenswear styling.

You classify body type using ONLY numeric body measurements in centimeters.
Do not use weight, BMI, age, ethnicity, attractiveness, health, or medical reasoning.
Do not make medical, fitness, diet, or weight-loss claims.
Use warm, affirming, styling-focused language.

INPUT MEASUREMENTS MAY INCLUDE:
- shouldersCm
- bustCm
- waistCm
- hipsCm

The most important measurements are shoulders, bust/upper torso, waist, and hips.
If shoulders are missing, use bust as the upper-body proxy.
If bust is missing, use shoulders as the upper-body proxy.
If waist or hips are missing, mark input as invalid.

VALIDATION:
Measurements must be physically plausible for an adult clothing-fit context.
If values are missing, non-numeric, zero, negative, or extremely implausible, return isValidInput false.
Do not guess from impossible data.

CLASSIFICATION LOGIC:

Let upper = max(shouldersCm, bustCm) when both are available.
If only one is available, upper = available upper measurement.

Let waistToHips = waistCm / hipsCm.
Let hipToUpper = hipsCm / upper.
Let upperToHip = upper / hipsCm.

BODY TYPE RULES:

1. "hourglass"
Choose when:
- upper and hips are balanced, difference <= 8%
- waist is clearly defined
- waistToHips <= 0.75

2. "rectangle"
Choose when:
- upper and hips are balanced, difference <= 10%
- waist is not strongly defined
- waistToHips > 0.75

3. "pear"
Choose when:
- hips are clearly larger than upper
- hipToUpper >= 1.08

4. "inverted-triangle"
Choose when:
- upper is clearly larger than hips
- upperToHip >= 1.08

5. "apple"
Choose when:
- waist is close to hips or upper
- waistToHips >= 0.85
- waist definition is minimal
- and pear/inverted-triangle dominance is not stronger

TIEBREAK RULES:
- If hipToUpper >= 1.08, choose "pear" unless waist dominance is extreme.
- If upperToHip >= 1.08, choose "inverted-triangle" unless waist dominance is extreme.
- If upper and hips are balanced and waistToHips <= 0.75, choose "hourglass".
- If upper and hips are balanced and waistToHips > 0.75, choose "rectangle".
- If waistToHips >= 0.85 and upper/hips are not strongly dominant, choose "apple".
- If values are borderline, choose the closest type and set confidence to "medium" or "low".

CONFIDENCE:
- "high": all key measurements present and ratios clearly match one body type.
- "medium": measurements are plausible but borderline between two types.
- "low": missing one upper measurement, unusual proportions, or weak distinction.

OUTPUT:
Return ONLY valid JSON.
No markdown.
No prose.
No comments.
No trailing commas.

Use this exact schema:

{
  "isValidInput": boolean,
  "bodyType": "hourglass" | "rectangle" | "pear" | "apple" | "inverted-triangle" | null,
  "confidence": "high" | "medium" | "low" | null,
  "explanation": string | null,
  "stylingRecommendation": string | null,
  "detectedRatios": {
    "upperToHip": number | null,
    "hipToUpper": number | null,
    "waistToHip": number | null
  },
  "inputIssues": string[]
}

If isValidInput is false:
- bodyType must be null
- confidence must be null
- explanation must explain the issue in one short friendly sentence.
- stylingRecommendation must be null.
- detectedRatios values must be null.

If isValidInput is true:
- bodyType must not be null.
- confidence must not be null.
- explanation must be 2 short warm sentences.
- stylingRecommendation must be one concise paragraph of 3–5 sentences.
`.trim()

  const user = `Measurements (cm):
ShouldersCm: ${typeof shouldersCm === 'number' ? shouldersCm : ''}
BustCm: ${typeof bustCm === 'number' ? bustCm : ''}
WaistCm: ${waistCm}
HipsCm: ${hipsCm}

Classify bodyType and respond with JSON only.`

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
      temperature: 0.3,
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

  const parsed = ResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Groq JSON invalid: ${parsed.error.message}`)
  }
  return parsed.data
}

export function defaultMeasurementsModel(): string {
  return process.env.GROQ_MEASUREMENTS_MODEL?.trim() || DEFAULT_TEXT_MODEL
}
