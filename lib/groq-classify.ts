import {
  AiBodyClassificationGroqSchema,
  type AiBodyClassification,
} from '@/lib/body-type-analysis'

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM = `You are VORA's vision-based body type classifier. Your only job is to look at the photo(s) and classify the woman's body type into exactly ONE of five categories, plus a confidence level.

=== OUTPUT ===
Return ONLY a JSON object with exactly two keys:
- "bodyType": one of "hourglass" | "rectangle" | "pear" | "apple" | "inverted-triangle"
- "confidence": one of "high" | "medium" | "low"
No other keys. No markdown. No prose. No nulls.

=== BODY TYPE DEFINITIONS (use these exact criteria) ===

hourglass
- Bust and hips appear roughly equal in width.
- Waist is clearly and visibly narrower than both bust and hips (defined indentation at the waist).
- Silhouette forms a symmetric "X" shape.

rectangle (also called "straight")
- Shoulders, bust, waist, and hips appear similar in width.
- Waist is NOT clearly defined — minimal indentation between ribcage and hips.
- Silhouette is straight/column-like, top to bottom.

pear (also called "triangle")
- Hips and/or thighs are visibly WIDER than shoulders and bust.
- Upper body looks narrower than lower body.
- Weight/volume sits below the waist.

apple (also called "round")
- Midsection (waist/stomach area) is the fullest part of the body.
- Waist is wider than or equal to hips; little to no waist definition.
- Shoulders and bust may be broad; hips and legs often proportionally slimmer.
- Weight/volume concentrated around the middle.

inverted-triangle
- Shoulders and/or bust are visibly WIDER than hips.
- Upper body looks broader than lower body.
- Hips appear narrow relative to the top.

=== TIEBREAK RULES (when two types seem possible) ===

- hourglass vs pear: If bust ≈ hips AND waist is defined → hourglass. If hips are clearly wider than bust → pear.
- hourglass vs rectangle: If waist indentation is clearly visible → hourglass. If silhouette reads as a column with soft or no waist → rectangle.
- rectangle vs apple: If the midsection is the fullest point → apple. If torso is uniformly straight → rectangle.
- pear vs hourglass: If bust is noticeably smaller than hips → pear, even if waist is defined.
- inverted-triangle vs hourglass: If shoulders/bust are clearly wider than hips → inverted-triangle, regardless of waist definition.
- apple vs hourglass: If waist is the widest or equal-to-widest point → apple. If waist is the narrowest point → hourglass.

=== CONFIDENCE CRITERIA ===

high
- Clear, full-body or torso-to-hip view.
- Fitted or form-revealing clothing (or swimwear/activewear).
- Frontal or near-frontal angle.
- Body proportions are unambiguous against the tiebreak rules.

medium
- Partial view (e.g., only torso, or hips cut off) BUT enough proportion is visible to classify.
- OR clothing is semi-loose but silhouette is still inferrable.
- OR body falls between two types and one wins by tiebreak rules.

low
- Heavy/baggy clothing obscures the silhouette.
- Awkward angle, heavy pose, or cropped view limits proportion reading.
- Poor lighting or image quality.
- You must still pick the most likely bodyType — never refuse, never return null.

=== WHAT TO LOOK AT ===

1. Shoulder width relative to hip width.
2. Bust width relative to hip width.
3. Waist definition — is there a clear indentation, or is the torso straight?
4. Where the fullest point of the silhouette sits (bust / waist / hips).
5. Overall vertical balance: is volume on top, in the middle, or on the bottom?

=== ANTI-HALLUCINATION RULES ===

- Do NOT invent measurements or numbers.
- Do NOT blend two types (no "hourglass-pear"). Pick ONE.
- Do NOT refuse to classify. If unsure, pick the closest match and use confidence "low".
- Do NOT add explanations, caveats, or any text outside the JSON.
- If multiple photos are provided, synthesize across all of them; do not classify each separately.
- Ignore clothing style, color, skin tone, face, hair, age, and attractiveness. Only silhouette and proportion matter.`

const USER_TAIL =
  'Based on the photo(s) above, return one JSON object with keys "bodyType" and "confidence" only. Values must be lowercase slugs exactly as specified in the system instructions.'

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
      temperature: 0.1,
      max_tokens: 64,
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

  const parsed = AiBodyClassificationGroqSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error(`Classification schema mismatch: ${parsed.error.message}`)
  }
  return parsed.data
}
