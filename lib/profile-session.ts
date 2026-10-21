import { BODY_TYPE_IDS, buildAnalysisFromBodyType, type BodyAnalysis, type BodyTypeId } from './body-type-analysis'

export const PROFILE_SESSION_KEY = 'vora_style_profile_v1'
export const PROFILE_TTL_MS = 12 * 60 * 60 * 1000

/** Keep only the styling category, never photos, measurements or contact details. */
export function encodeProfile(analysis: BodyAnalysis, view: 'results' | 'recommendations', now = Date.now()) {
  return JSON.stringify({ bodyType: analysis.bodyType, confidence: analysis.confidence,
    source: analysis.analysisSource, photoCount: analysis.analysisSource === 'photo' ? analysis.photoCount : undefined, view, createdAt: now })
}

export function decodeProfile(raw: string | null, now = Date.now()) {
  if (!raw || raw.length > 512) return null
  try {
    const value = JSON.parse(raw)
    if (!value || !BODY_TYPE_IDS.includes(value.bodyType) ||
      !['high', 'medium', 'low'].includes(value.confidence) ||
      !['photo', 'measurement'].includes(value.source) ||
      (value.photoCount !== undefined && (!Number.isInteger(value.photoCount) || value.photoCount < 1 || value.photoCount > 3 || value.source !== 'photo')) ||
      !['results', 'recommendations'].includes(value.view) ||
      !Number.isFinite(value.createdAt) || value.createdAt > now || now - value.createdAt > PROFILE_TTL_MS) return null
    return {
      analysis: { ...buildAnalysisFromBodyType(value.bodyType as BodyTypeId, value.confidence), analysisSource: value.source, photoCount: value.photoCount } as BodyAnalysis,
      view: value.view as 'results' | 'recommendations',
    }
  } catch { return null }
}
