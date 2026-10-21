import type { BodyTypeId, StyleProduct } from './body-type-analysis'
import type { BodyTypeArticle } from './body-type-articles'

export interface StyleCatalog {
  version: 1
  source: 'webflow' | 'bundled'
  fetchedAt: string
  byBodyType: Record<BodyTypeId, StyleProduct[]>
  byArticleSlug: Record<string, StyleProduct[]>
  articlesByBodyType: Partial<Record<BodyTypeId, BodyTypeArticle>>
}

export const AFFILIATE_DISCLOSURE = 'Some links are affiliate links. VORA may earn a commission if you buy through them.'
