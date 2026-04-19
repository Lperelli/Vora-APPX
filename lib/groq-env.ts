/** Groq API key from env (Vercel / .env.local). */
export function resolveGroqApiKey(): string {
  return (process.env.GROQ_API_KEY ?? process.env.GROQ_KEY ?? '').trim()
}
