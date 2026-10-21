/** Enable only after VORA has approved and published both legal documents. */
export function legalDocuments(env: Record<string, string | undefined>) {
  const terms = env.NEXT_PUBLIC_VORA_TERMS_URL
  const privacy = env.NEXT_PUBLIC_VORA_PRIVACY_URL
  const version = env.NEXT_PUBLIC_VORA_LEGAL_VERSION
  if (!terms || !privacy || !version || version.length > 80) return null
  try {
    if ([terms, privacy].some(value => new URL(value).protocol !== 'https:')) return null
    return { terms, privacy, version }
  } catch { return null }
}

export const LEGAL_DOCUMENTS = legalDocuments({
  NEXT_PUBLIC_VORA_TERMS_URL: process.env.NEXT_PUBLIC_VORA_TERMS_URL,
  NEXT_PUBLIC_VORA_PRIVACY_URL: process.env.NEXT_PUBLIC_VORA_PRIVACY_URL,
  NEXT_PUBLIC_VORA_LEGAL_VERSION: process.env.NEXT_PUBLIC_VORA_LEGAL_VERSION,
})
