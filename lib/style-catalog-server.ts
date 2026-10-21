import { BODY_TYPE_IDS, STYLE_EDITORIAL, type BodyTypeId, type StyleProduct } from './body-type-analysis'
import { BODY_TYPE_ARTICLES, type BodyTypeArticle } from './body-type-articles'
import type { StyleCatalog } from './style-catalog'
import config from '@/integrations/webflow/catalog/config.json'

export const CATALOG_CACHE_MS = 120_000
const MAX_ITEMS = 1000
const REQUEST_TIMEOUT_MS = 8000
type Env = Record<string, string | undefined>
export interface CmsItem {
  id: string
  isDraft?: boolean
  isArchived?: boolean
  fieldData: Record<string, unknown>
}

const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const live = (item: CmsItem) => !item.isDraft && !item.isArchived

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096) return
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') ||
        url.hostname.endsWith('.local') || url.hostname === 'localhost') return
    return url.href
  } catch { return }
}

const shapeOptions = Object.fromEntries(Object.entries(config.bodyShapeOptions).map(([shape, id]) => [id, shape])) as Record<string, BodyTypeId>

/** Only published, active, validated public catalog fields leave the server. */
export function buildStyleCatalog(products: CmsItem[], picks: CmsItem[], articles: CmsItem[], timestamp = Date.now()): StyleCatalog {
  const catalog: StyleCatalog = {
    version: 1, source: 'webflow', fetchedAt: new Date(timestamp).toISOString(),
    byBodyType: { hourglass: [], rectangle: [], triangle: [], 'inverted-triangle': [] },
    byArticleSlug: Object.create(null), articlesByBodyType: {},
  }
  const productMap = new Map<string, StyleProduct>()
  for (const item of products) {
    const f = item.fieldData
    if (!live(item) || f.active !== true) continue
    const name = text(f.name, 256), brand = text(f.brand, 256)
    const image = httpsUrl((f['product-image'] as {url?: unknown} | undefined)?.url)
    const affiliate = text(f['affiliate-url'], 4096)
    const shopUrl = httpsUrl(affiliate || f['store-url'])
    // An invalid configured affiliate link must never silently become an untracked link.
    if (!name || !brand || !image || !shopUrl) continue
    const ratio = text(f['image-aspect-ratio']).replace(/\s/g, '')
    const imageAspectRatio = ratio === '4/5' ? '4 / 5' : ratio === '3/4' ? '3 / 4' : '2 / 3'
    productMap.set(item.id, { id: item.id, name, brand, image, shopUrl,
      price: text(f['price-label'], 80) || 'View current price', stylingNote: '', imageAspectRatio, isAffiliate: Boolean(affiliate) })
  }
  const articleMap = new Map<string, {slug: string; managed: boolean; article: BodyTypeArticle}>()
  for (const item of articles) {
    const f = item.fieldData, slug = text(f.slug, 256)
    const image = httpsUrl((f['thumbnail-image'] as {url?: unknown} | undefined)?.url)
    if (!live(item) || f['vora-approved'] !== true || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !image || !text(f.name)) continue
    articleMap.set(item.id, { slug, managed: f['use-vora-catalog'] === true, article: { title: text(f.name, 256), summary: text(f['post-summary'], 1500),
      image, url: `${config.blogOrigin}/post/${slug}` } })
    if (f['use-vora-catalog'] === true) catalog.byArticleSlug[slug] = []
  }
  const seenByShape = new Map<BodyTypeId, Set<string>>()
  const seenByArticle = new Map<string, Set<string>>()
  const ordered = [...picks].sort((a, b) => Number(a.fieldData['display-order']) - Number(b.fieldData['display-order']) || a.id.localeCompare(b.id))
  for (const item of ordered) {
    const f = item.fieldData
    const option = text(f['body-shape'])
    const shape = Object.prototype.hasOwnProperty.call(shapeOptions, option) ? shapeOptions[option] : undefined
    const order = f['display-order'], note = text(f['styling-note'], 1500)
    if (!live(item) || f.active !== true || !shape || !Number.isFinite(order) || Number(order) < 0 || !note) continue
    const related = articleMap.get(text(f.article))
    if (related) {
      catalog.articlesByBodyType[shape] ??= related.article
    }
    const product = productMap.get(text(f.product))
    if (!product) continue
    const selected = { ...product, stylingNote: note }
    const seen = seenByShape.get(shape) ?? new Set<string>()
    if (!seen.has(product.id!) && catalog.byBodyType[shape].length < 5) catalog.byBodyType[shape].push(selected)
    seen.add(product.id!); seenByShape.set(shape, seen)
    if (related?.managed) {
      const seenArticle = seenByArticle.get(related.slug) ?? new Set<string>()
      if (!seenArticle.has(product.id!)) catalog.byArticleSlug[related.slug].push(selected)
      seenArticle.add(product.id!); seenByArticle.set(related.slug, seenArticle)
    }
  }
  return catalog
}

function bundledCatalog(timestamp: number): StyleCatalog {
  const byBodyType = Object.fromEntries(BODY_TYPE_IDS.map(shape => [shape, STYLE_EDITORIAL[shape].products])) as StyleCatalog['byBodyType']
  return { version: 1, source: 'bundled', fetchedAt: new Date(timestamp).toISOString(), byBodyType,
    byArticleSlug: Object.fromEntries(BODY_TYPE_IDS.flatMap(shape => {
      const article = BODY_TYPE_ARTICLES[shape]
      return article ? [[new URL(article.url).pathname.split('/').pop()!, byBodyType[shape]]] : []
    })), articlesByBodyType: BODY_TYPE_ARTICLES }
}

async function readItems(collectionId: string, token: string, signal: AbortSignal, fetcher: typeof fetch): Promise<CmsItem[]> {
  const items: CmsItem[] = []
  for (let offset = 0; offset < MAX_ITEMS; offset += 100) {
    const response = await fetcher(`https://api.webflow.com/v2/collections/${collectionId}/items/live?limit=100&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store', redirect: 'error',
    })
    if (!response.ok) throw new Error('Catalog upstream unavailable')
    const raw = await response.text()
    if (raw.length > 2_000_000) throw new Error('Catalog page too large')
    const data = JSON.parse(raw)
    if (!Array.isArray(data.items) || data.items.length > 100 || !Number.isInteger(data.pagination?.total) || data.pagination.total < 0 || data.pagination.total > MAX_ITEMS) throw new Error('Invalid catalog response')
    for (const item of data.items) {
      if (!item || typeof item.id !== 'string' || !item.fieldData || typeof item.fieldData !== 'object' || Array.isArray(item.fieldData)) throw new Error('Invalid catalog item')
      items.push(item)
    }
    if (offset + data.items.length >= data.pagination.total) return items
    if (data.items.length !== 100) throw new Error('Incomplete catalog page')
  }
  throw new Error('Catalog pagination limit reached')
}

export function createStyleCatalogHandler({ env = () => process.env, fetcher = fetch, now = Date.now }:
  {env?: () => Env; fetcher?: typeof fetch; now?: () => number} = {}) {
  let cached: {token: string; expires: number; catalog: StyleCatalog} | undefined
  let pending: {token: string; promise: Promise<StyleCatalog>} | undefined
  return async function GET() {
    const token = env().WEBFLOW_CMS_API_TOKEN?.trim()
    const reply = (catalog: StyleCatalog) => Response.json(catalog, { headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=30',
      'X-Content-Type-Options': 'nosniff',
    } })
    if (!token) return reply(bundledCatalog(now()))
    if (cached?.token === token && cached.expires > now()) return reply(cached.catalog)
    try {
      if (pending?.token !== token) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
        const promise = Promise.all([
          readItems(config.productsCollectionId, token, controller.signal, fetcher),
          readItems(config.picksCollectionId, token, controller.signal, fetcher),
          readItems(config.articlesCollectionId, token, controller.signal, fetcher),
        ]).then(([products, picks, articles]) => {
          const catalog = buildStyleCatalog(products, picks, articles, now())
          cached = { token, expires: now() + CATALOG_CACHE_MS, catalog }
          return catalog
        }).finally(() => { clearTimeout(timer); if (pending?.promise === promise) pending = undefined })
        pending = { token, promise }
      }
      return reply(await pending.promise)
    } catch {
      // Never expose upstream responses, authorization headers or draft records.
      return Response.json({ source: 'webflow', error: 'catalog_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
  }
}
