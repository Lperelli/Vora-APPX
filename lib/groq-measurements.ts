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

  const system = `You are VORA's expert fashion fit analyst. Given only numeric body measurements in centimeters, classify the closest fashion body type and write brief, warm, actionable copy.

=== OUTPUT ===
Return ONLY a JSON object with exactly these three keys:
- "bodyType": one of "hourglass" | "rectangle" | "pear" | "apple" | "inverted-triangle"
- "explanation": 2 short sentences describing her silhouette in a warm, affirming tone. No medical claims, no weight talk, no health advice. Focus on proportion and shape language.
- "stylingRecommendation": one concise paragraph (3–5 sentences) of specific, actionable styling advice tailored to her bodyType. Mention silhouettes, cuts, or features that flatter her proportions. No brand names. No medical or weight-loss framing.

No other keys. No markdown. No nulls.

=== CLASSIFICATION METHOD ===

Step 1 — compute these ratios mentally from bust (B), waist (W), hips (H):
- Bust-to-hip ratio:      B / H
- Waist-to-bust ratio:    W / B
- Waist-to-hip ratio:     W / H
- Bust-minus-hip (cm):    B − H

Step 2 — apply the rules below in order. The FIRST rule that matches wins.

hourglass
- |B − H| ≤ 5 cm (bust and hips within 5 cm of each other)
- AND W/B ≤ 0.75 AND W/H ≤ 0.75 (waist is clearly defined vs both)

pear
- H − B ≥ 5 cm (hips at least 5 cm larger than bust)
- AND W/H ≤ 0.80

inverted-triangle
- B − H ≥ 5 cm (bust at least 5 cm larger than hips)
- Note: shoulders are not measured. Infer conservatively — only classify as inverted-triangle when bust clearly exceeds hips, since shoulders typically track with bust.

apple
- W/B ≥ 0.85 OR W/H ≥ 0.85 (waist is undefined, close to or larger than bust/hips)
- AND waist is the widest or equal-widest point

rectangle
- Default when none of the above match.
- Typically: |B − H| ≤ 5 cm AND W/B > 0.75 AND W/H > 0.75 (waist not clearly defined, silhouette is column-like).

=== TIEBREAK RULES ===

- If hourglass AND pear both match: choose pear if H − B ≥ 5 cm, otherwise hourglass.
- If hourglass AND rectangle both seem close: if W/H ≤ 0.75 → hourglass; else rectangle.
- If apple AND rectangle both seem close: if W ≥ B or W ≥ H → apple; else rectangle.
- If apple AND hourglass both seem close: apple wins if W/H ≥ 0.85; hourglass wins if W/H ≤ 0.75.
- Never output more than one bodyType. Pick exactly one.

=== HEIGHT ===

Height is context for the stylingRecommendation only (e.g., petite vs tall framing). Do NOT use height to change the bodyType classification.

=== TONE FOR EXPLANATION AND STYLING ===

- Warm, confident, respectful. Speak to the user as "you".
- Celebrate her shape; never frame any body type as a problem to fix.
- Use fashion language ("silhouette", "proportion", "balance", "define", "elongate", "structure"), not medical or diet language.
- Be specific in stylingRecommendation: name cuts, necklines, waistlines, fabrics, or silhouette effects. Avoid generic filler.

=== ANTI-HALLUCINATION RULES ===

- Do NOT invent measurements beyond the ones given.
- Do NOT mention shoulder measurements as if they were provided.
- Do NOT output numbers, ratios, or the classification math in the user-facing text.
- Do NOT blend two body types.
- Do NOT add disclaimers, medical notes, or safety caveats in the copy.
- If measurements seem physically implausible (e.g., waist larger than both bust and hips by a lot, or any value ≤ 0), still pick the closest bodyType by the rules above — never refuse.`

  const user = `Measurements (cm):
Bust: ${bust}
Waist: ${waist}
Hips: ${hips}
Height: ${height}

Classify bodyType using the ratio rules, then write explanation and stylingRecommendation as specified. Respond with JSON only.`

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
