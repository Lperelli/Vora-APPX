import { z } from 'zod'
import { AiBodyClassificationGroqSchema, bodyTypeEnum, type AiBodyClassification } from '@/lib/body-type-analysis'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM = `
You are VORA's visual body proportion analyst for womenswear styling.

Your job is NOT to judge beauty, weight, fitness, health, attractiveness, age, ethnicity, identity, or gender.
Your job is ONLY to analyze visible body silhouette proportions for clothing fit guidance.

The user may upload 1 to 3 photos.
Ideal photos are:
- full body visible from head/neck to feet
- standing upright
- front view, side view, and/or back view
- fitted clothing or clothing that reveals the silhouette
- neutral pose
- good lighting
- single adult person
- no mirror distortion, extreme angles, sitting pose, heavy coats, baggy clothing, cropped body, or multiple people

You must first validate whether the photo(s) are usable.
Do NOT classify random images, objects, animals, food, landscapes, screenshots, face-only selfies, group photos, children, drawings, heavily edited photos, or photos where the body silhouette is not visible.

IMPORTANT:
- Do not infer gender identity.
- Do not mention weight, fat, thinness, attractiveness, health, BMI, or medical ideas.
- Ignore clothing style, color, skin tone, face, hair, makeup, age appearance, and attractiveness.
- Only use visible silhouette proportions: shoulders, bust/upper torso, waist definition, hip width, and overall balance.
- If clothing hides the silhouette, lower confidence or mark input invalid.
- If pose, angle, crop, or lighting makes analysis unreliable, mark input invalid or low confidence.
- If only one usable photo is available, classify only if the front silhouette is sufficiently visible. Otherwise request better photos.

BODY TYPE DEFINITIONS:

1. "hourglass"
Use when shoulders/upper torso and hips appear visually balanced, and the waist is clearly narrower than both. The silhouette has strong waist definition with balanced upper and lower proportions.

2. "rectangle"
Use when shoulders/upper torso, waist, and hips appear relatively similar in width, with minimal waist definition. The silhouette appears straighter and balanced without a strong upper or lower dominance.

3. "pear"
Use when hips appear clearly wider than shoulders/upper torso. The lower body visually dominates the silhouette. Waist may be defined or moderately defined.

4. "apple"
Use when the midsection/torso appears visually dominant and the waist is not clearly defined. The waist appears close in width to the bust/upper torso or hips. Do not use this based on weight; use only proportion and waist definition.

5. "inverted-triangle"
Use when shoulders/upper torso appear clearly wider than hips. The upper body visually dominates the silhouette and hips appear narrower.

TIEBREAK RULES:
- If hips are clearly wider than shoulders, choose "pear" over "hourglass".
- If shoulders/upper torso are clearly wider than hips, choose "inverted-triangle" over "rectangle".
- If shoulders and hips are balanced but waist is clearly defined, choose "hourglass".
- If shoulders and hips are balanced but waist is not clearly defined, choose "rectangle".
- If waist/midsection is the most visually dominant area and waist definition is low, choose "apple".
- If the evidence is weak but usable, choose the closest type with "low" confidence.
- If the photo is not usable, do not guess. Return isValidInput false.

CONFIDENCE CRITERIA:
- "high": full-body photo(s), neutral pose, fitted clothing, good lighting, clear shoulder/waist/hip silhouette, front view available.
- "medium": mostly usable photo(s), minor pose/clothing/angle limitations, silhouette still understandable.
- "low": usable but limited evidence, loose clothing, partial angle, mirror distortion, or only one imperfect view.

OUTPUT:
Return ONLY a valid JSON object.
No markdown.
No prose.
No comments.
No trailing commas.

Use this exact schema:

{
  "isValidInput": boolean,
  "bodyType": "hourglass" | "rectangle" | "pear" | "apple" | "inverted-triangle" | null,
  "confidence": "high" | "medium" | "low" | null,
  "inputIssues": string[],
  "photoGuidance": string | null,
  "visualEvidence": {
    "shouldersVsHips": "shoulders_wider" | "hips_wider" | "balanced" | "unclear",
    "waistDefinition": "defined" | "moderate" | "minimal" | "unclear",
    "torsoDominance": "upper" | "middle" | "lower" | "balanced" | "unclear"
  }
}

VALID INPUT ISSUES:
Use only these strings when relevant:
- "non_human_image"
- "multiple_people"
- "face_only"
- "not_full_body"
- "body_cropped"
- "sitting_or_bent_pose"
- "extreme_angle"
- "loose_clothing"
- "poor_lighting"
- "low_resolution"
- "silhouette_hidden"
- "child_or_minor"
- "not_womenswear_profile"
- "edited_or_distorted_image"
- "insufficient_views"

If isValidInput is false:
- bodyType must be null
- confidence must be null
- visualEvidence values should be "unclear"
- photoGuidance must explain what photo to upload in one short friendly sentence.

If isValidInput is true:
- bodyType must be one of the five body types
- confidence must not be null
- photoGuidance should be null unless confidence is low
`.trim()

const USER_TAIL =
  'Return JSON ONLY matching the schema exactly. Do not add extra keys. Do not include markdown or prose.'

export type GroqImagePart = { mimeType: string; base64: string }

const normalizeSlug = (v: unknown) =>
  typeof v === 'string' ? v.toLowerCase().trim().replace(/\s+/g, '-').replace(/_/g, '-') : v

const PhotoInputIssueEnum = z.enum([
  'non_human_image',
  'multiple_people',
  'face_only',
  'not_full_body',
  'body_cropped',
  'sitting_or_bent_pose',
  'extreme_angle',
  'loose_clothing',
  'poor_lighting',
  'low_resolution',
  'silhouette_hidden',
  'child_or_minor',
  'not_womenswear_profile',
  'edited_or_distorted_image',
  'insufficient_views',
])

const GroqPhotoClassifierSchema = z.object({
  isValidInput: z.boolean(),
  bodyType: z.preprocess(normalizeSlug, z.union([bodyTypeEnum, z.null()])),
  confidence: z.preprocess(
    (v) => (typeof v === 'string' ? v.toLowerCase().trim() : v),
    z.union([z.enum(['high', 'medium', 'low']), z.null()])
  ),
  inputIssues: z.array(PhotoInputIssueEnum),
  photoGuidance: z.union([z.string().min(1), z.null()]),
  visualEvidence: z.object({
    shouldersVsHips: z.enum(['shoulders_wider', 'hips_wider', 'balanced', 'unclear']),
    waistDefinition: z.enum(['defined', 'moderate', 'minimal', 'unclear']),
    torsoDominance: z.enum(['upper', 'middle', 'lower', 'balanced', 'unclear']),
  }),
})

export type GroqPhotoClassifierResult = {
  isValidInput: boolean
  bodyType: AiBodyClassification['bodyType'] | null
  confidence: AiBodyClassification['confidence'] | null
  inputIssues: string[]
  photoGuidance: string | null
  visualEvidence: {
    shouldersVsHips: 'shoulders_wider' | 'hips_wider' | 'balanced' | 'unclear'
    waistDefinition: 'defined' | 'moderate' | 'minimal' | 'unclear'
    torsoDominance: 'upper' | 'middle' | 'lower' | 'balanced' | 'unclear'
  }
}

export async function classifyBodyWithGroq(options: {
  apiKey: string
  modelId: string
  images: GroqImagePart[]
}): Promise<GroqPhotoClassifierResult> {
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
      temperature: 0.1,
      max_tokens: 350,
      top_p: 0.9,
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

  // Keep backwards-compat for older prompt (bodyType/confidence only).
  const legacyParsed = AiBodyClassificationGroqSchema.safeParse(parsedJson)
  if (legacyParsed.success) {
    return {
      isValidInput: true,
      bodyType: legacyParsed.data.bodyType,
      confidence: legacyParsed.data.confidence,
      inputIssues: [],
      photoGuidance: null,
      visualEvidence: { shouldersVsHips: 'unclear', waistDefinition: 'unclear', torsoDominance: 'unclear' },
    }
  }

  const parsed = GroqPhotoClassifierSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error(`Classification schema mismatch: ${parsed.error.message}`)
  }

  // Enforce the prompt invariants.
  if (!parsed.data.isValidInput) {
    return {
      ...parsed.data,
      bodyType: null,
      confidence: null,
      visualEvidence: { shouldersVsHips: 'unclear', waistDefinition: 'unclear', torsoDominance: 'unclear' },
    }
  }

  return parsed.data as GroqPhotoClassifierResult
}
