import { generateText, Output } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

const BodyAnalysisSchema = z.object({
  bodyType: z.enum(['hourglass', 'rectangle', 'pear', 'apple', 'inverted-triangle']),
  bodyTypeLabel: z.string(),
  silhouetteDescription: z.string(),
  whatWorksForYou: z.array(z.string()),
  whatToAvoid: z.array(z.string()),
  celebrities: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    })
  ),
  styleRecommendations: z.array(
    z.object({
      category: z.string(),
      tip: z.string(),
    })
  ),
  confidence: z.string(),
})

export type BodyAnalysis = z.infer<typeof BodyAnalysisSchema>

const SYSTEM_PROMPT = `You are VORA, a fashion body-type classifier. You ONLY classify body types and give style recommendations. You NEVER discuss any other topic, ask questions, or refuse to analyze.

TASK: Look at the full-body photo(s) and classify the body type into exactly one of these five types based on the proportions of shoulders, waist, and hips:
- hourglass: bust and hips roughly equal, waist clearly narrower — defined curves
- rectangle: shoulders, waist, and hips roughly the same width — straight silhouette
- pear: hips and thighs noticeably wider than shoulders — volume below the waist
- apple: midsection and waist wider than bust and hips — volume in the middle
- inverted-triangle: shoulders and bust noticeably wider than hips — broad top, narrow bottom

OUTPUT REQUIREMENTS (you must always return valid JSON with ALL these fields):
{
  "bodyType": "<one of the five enum values>",
  "bodyTypeLabel": "<e.g. Hourglass, Rectangle, Pear, Apple, Inverted Triangle>",
  "silhouetteDescription": "<2-3 warm, empowering sentences specific to this body shape>",
  "whatWorksForYou": ["<tip 1>", "<tip 2>", "<tip 3>", "<tip 4>"],
  "whatToAvoid": ["<thing 1>", "<thing 2>", "<thing 3>"],
  "celebrities": [
    {"name": "<real celebrity>", "reason": "<why they share this body type>"},
    ... 4 total
  ],
  "styleRecommendations": [
    {"category": "Tops", "tip": "<specific tip>"},
    {"category": "Bottoms", "tip": "<specific tip>"},
    {"category": "Dresses", "tip": "<specific tip>"},
    {"category": "Outerwear", "tip": "<specific tip>"},
    {"category": "Accessories", "tip": "<specific tip>"}
  ],
  "confidence": "<high | medium | low>"
}

RULES:
- ALWAYS pick the closest matching type — never say "unclear" or refuse
- confidence = "high" if full body clearly visible, "medium" if partial, "low" if very unclear
- Never add any text outside the JSON structure
- If photo quality is poor, still make your best determination`

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const imageContents: { type: 'image'; image: string; mimeType: string }[] = []

    for (let i = 0; i < 3; i++) {
      const file = formData.get(`photo_${i}`) as File | null
      if (file) {
        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        const mimeType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
        imageContents.push({ type: 'image', image: base64, mimeType })
      }
    }

    if (imageContents.length === 0) {
      return Response.json({ error: 'No images provided' }, { status: 400 })
    }

    const result = await generateText({
      // llama-4-scout-17b-16e-instruct is the free vision model on Groq
      model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
      experimental_output: Output.object({ schema: BodyAnalysisSchema }),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: 'Analyze the body type in this photo and return the complete JSON styling profile. Output only valid JSON.',
            },
          ],
        },
      ],
    })

    return Response.json({ analysis: result.experimental_output })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[vora] Analysis error:', msg)
    return Response.json(
      { error: 'Analysis failed. Please try again.', detail: msg },
      { status: 500 }
    )
  }
}

