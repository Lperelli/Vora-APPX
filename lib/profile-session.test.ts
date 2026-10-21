import { describe, expect, it } from 'vitest'
import { buildAnalysisFromBodyType } from './body-type-analysis'
import { decodeProfile, encodeProfile, PROFILE_TTL_MS } from './profile-session'
import { legalDocuments } from './legal-consent'

describe('private session continuity', () => {
  const now = 1_800_000_000_000
  const analysis = { ...buildAnalysisFromBodyType('triangle', 'medium'), analysisSource: 'photo' as const }
  it('restores the profile and selected screen without storing measurements, images or editorial data', () => {
    const encoded = encodeProfile(analysis, 'recommendations', now)
    expect(Object.keys(JSON.parse(encoded))).toEqual(['bodyType', 'confidence', 'source', 'view', 'createdAt'])
    expect(encoded).not.toContain('image')
    expect(decodeProfile(encoded, now + 100)?.analysis.bodyType).toBe('triangle')
    expect(decodeProfile(encoded, now + 100)?.analysis.analysisSource).toBe('photo')
    expect(decodeProfile(encoded, now + 100)?.view).toBe('recommendations')
  })
  it('ignores expired, future, malformed or unsupported profiles', () => {
    expect(decodeProfile(encodeProfile(analysis, 'results', now), now + PROFILE_TTL_MS + 1)).toBeNull()
    expect(decodeProfile(encodeProfile(analysis, 'results', now + 1), now)).toBeNull()
    for (const raw of [null, '{}', '{bad', 'null', 'x'.repeat(513), JSON.stringify({ ...JSON.parse(encodeProfile(analysis, 'results', now)), bodyType: 'apple' })]) {
      expect(decodeProfile(raw, now)).toBeNull()
    }
  })
})

describe('legal consent activation', () => {
  const approved = { NEXT_PUBLIC_VORA_TERMS_URL: 'https://vora.example/terms', NEXT_PUBLIC_VORA_PRIVACY_URL: 'https://vora.example/privacy', NEXT_PUBLIC_VORA_LEGAL_VERSION: 'approved-v1' }
  it('requires both published HTTPS documents and an approved version', () => {
    expect(legalDocuments(approved)?.version).toBe('approved-v1')
    expect(legalDocuments({})).toBeNull()
    expect(legalDocuments({ ...approved, NEXT_PUBLIC_VORA_LEGAL_VERSION: '' })).toBeNull()
    expect(legalDocuments({ ...approved, NEXT_PUBLIC_VORA_TERMS_URL: 'javascript:alert(1)' })).toBeNull()
    expect(legalDocuments({ ...approved, NEXT_PUBLIC_VORA_PRIVACY_URL: '/draft' })).toBeNull()
  })
})
