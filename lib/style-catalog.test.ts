import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { parseHTML } from 'linkedom'
import config from '@/integrations/webflow/catalog/config.json'
import { buildStyleCatalog, CATALOG_CACHE_MS, createStyleCatalogHandler, type CmsItem } from './style-catalog-server'

const product = (id = 'product-1', extra: Record<string, unknown> = {}): CmsItem => ({ id, isDraft: false,
  fieldData: { name: `Product ${id}`, brand: 'Vora test brand', active: true,
    'store-url': `https://store.example/${id}`, 'affiliate-url': 'https://tracking.example/click?publisher=vora&item=1',
    'product-image': { url: 'https://images.example/full-garment.webp' }, 'image-aspect-ratio': '4/5', ...extra } })
const article = (extra: Record<string, unknown> = {}): CmsItem => ({ id: 'article-1', isDraft: false,
  fieldData: { name: 'A published styling edit', slug: 'hourglass-edit', 'post-summary': 'Updated CMS summary',
    'thumbnail-image': {url:'https://images.example/article.webp'}, 'vora-approved':true, 'use-vora-catalog':true, ...extra } })
const pick = (id = 'pick-1', extra: Record<string, unknown> = {}): CmsItem => ({id, isDraft:false,
  fieldData:{product:'product-1',article:'article-1',active:true,'body-shape':config.bodyShapeOptions.hourglass,
    'display-order':1,'styling-note':'Follow your waist with soft tailoring.',...extra}})
const jsonPage = (items: CmsItem[], total = items.length) => Response.json({ items, pagination: {total, limit:100, offset:0} })

describe('shared styling catalog', () => {
  it('uses one affiliate destination for app and article, while keeping silhouette-specific copy', () => {
    const data = buildStyleCatalog([product()], [pick(), pick('pick-2', {'body-shape':config.bodyShapeOptions.triangle,'styling-note':'Draw the eye upward.'})], [article()])
    expect(data.byBodyType.hourglass[0].shopUrl).toBe(data.byArticleSlug['hourglass-edit'][0].shopUrl)
    expect(data.byBodyType.hourglass[0].isAffiliate).toBe(true)
    expect(data.byBodyType.hourglass[0].imageAspectRatio).toBe('4 / 5')
    expect(data.byBodyType.triangle[0].stylingNote).toBe('Draw the eye upward.')
    expect(data.articlesByBodyType.hourglass?.summary).toBe('Updated CMS summary')
  })
  it('uses the original store link only when no affiliate link is configured', () => {
    expect(buildStyleCatalog([product('product-1',{'affiliate-url':''})],[pick()],[article()]).byBodyType.hourglass[0].shopUrl).toBe('https://store.example/product-1')
    expect(buildStyleCatalog([product('product-1',{'affiliate-url':'javascript:alert(1)'})],[pick()],[article()]).byBodyType.hourglass).toEqual([])
  })
  it('removes inactive, archived and draft garments from both surfaces', () => {
    for (const garment of [product('product-1',{active:false}), {...product(), isDraft:true}, {...product(),isArchived:true}]) {
      const data = buildStyleCatalog([garment],[pick()],[article()])
      expect(data.byBodyType.hourglass).toEqual([])
      expect(data.byArticleSlug['hourglass-edit']).toEqual([])
    }
  })
  it('removes old article cards when all picks are withdrawn and respects unmanaged articles', () => {
    expect(buildStyleCatalog([product()],[],[article()]).byArticleSlug['hourglass-edit']).toEqual([])
    expect(buildStyleCatalog([product()],[pick()],[article({'use-vora-catalog':false})]).byArticleSlug).toEqual({})
  })
  it('sorts, deduplicates and limits the app to five choices while retaining the complete article edit', () => {
    const products = Array.from({length:7},(_,i)=>product(`p-${i}`,{'affiliate-url':''}))
    const picks = products.map((p,i)=>pick(`pick-${i}`,{product:p.id,'display-order':7-i}))
    const data = buildStyleCatalog(products,[...picks,pick('duplicate',{product:'p-6','display-order':0})],[article()])
    expect(data.byBodyType.hourglass).toHaveLength(5)
    expect(data.byBodyType.hourglass[0].id).toBe('p-6')
    expect(data.byArticleSlug['hourglass-edit']).toHaveLength(7)
  })
  it('does not leak rich text, hidden fields or contact data and tolerates inherited-key slugs', () => {
    const data = buildStyleCatalog([product('product-1',{internal_notes:'private draft',email:'private@example.test'})],
      [pick()],[article({slug:'constructor','post-body':'<script>private source</script>'})])
    expect(data.byArticleSlug.constructor).toHaveLength(1)
    expect(JSON.stringify(data)).not.toContain('private')
    expect(buildStyleCatalog([product()],[pick('bad',{'body-shape':'constructor'})],[article()]).byBodyType.hourglass).toEqual([])
  })
})

describe('catalog endpoint', () => {
  function transport() {
    return vi.fn<typeof fetch>(async input => {
      const url=String(input)
      return url.includes(config.productsCollectionId) ? jsonPage([product()]) : url.includes(config.picksCollectionId) ? jsonPage([pick()]) : jsonPage([article()])
    })
  }
  it('preserves existing recommendations while the private CMS credential is not configured', async () => {
    const fetcher=transport(), get=createStyleCatalogHandler({env:()=>({}),fetcher})
    const data=await (await get()).json()
    expect(data.source).toBe('bundled'); expect(data.byBodyType.hourglass).toHaveLength(5); expect(fetcher).not.toHaveBeenCalled()
  })
  it('reads only live CMS records and keeps the token on the server', async () => {
    const fetcher=transport(), token='test-private-token'
    const response=await createStyleCatalogHandler({env:()=>({WEBFLOW_CMS_API_TOKEN:token}),fetcher})()
    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain(token)
    for(const [url, init] of fetcher.mock.calls) {
      expect(String(url)).toContain('/items/live?'); expect(init?.headers).toEqual({Authorization:`Bearer ${token}`})
    }
  })
  it('reuses a short snapshot, then picks up a published link change', async () => {
    let timestamp=1000, destination='https://tracking.example/first'
    const fetcher=transport()
    fetcher.mockImplementation(async input=>String(input).includes(config.productsCollectionId) ? jsonPage([product('product-1',{'affiliate-url':destination})]) : String(input).includes(config.picksCollectionId) ? jsonPage([pick()]) : jsonPage([article()]))
    const get=createStyleCatalogHandler({env:()=>({WEBFLOW_CMS_API_TOKEN:'test'}),fetcher,now:()=>timestamp})
    await Promise.all([get(),get()]); expect(fetcher).toHaveBeenCalledTimes(3)
    destination='https://tracking.example/changed'; timestamp+=CATALOG_CACHE_MS+1
    const data=await (await get()).json()
    expect(data.byBodyType.hourglass[0].shopUrl).toBe(destination)
    expect(data.byArticleSlug['hourglass-edit'][0].shopUrl).toBe(destination)
  })
  it('loads every page instead of silently truncating the catalog', async () => {
    const fetcher=transport()
    fetcher.mockImplementation(async input=>{
      const url=String(input)
      if(url.includes(config.productsCollectionId)) return url.includes('offset=100') ? jsonPage([product()],101) : jsonPage(Array.from({length:100},(_,i)=>product(`first-${i}`)),101)
      return url.includes(config.picksCollectionId) ? jsonPage([pick()]) : jsonPage([article()])
    })
    const response=await createStyleCatalogHandler({env:()=>({WEBFLOW_CMS_API_TOKEN:'test'}),fetcher})()
    expect((await response.json()).byBodyType.hourglass).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
  it('fails without exposing upstream errors or returning a stale shopping destination', async () => {
    const fetcher=vi.fn<typeof fetch>(async()=>new Response('sensitive upstream error',{status:401}))
    const response=await createStyleCatalogHandler({env:()=>({WEBFLOW_CMS_API_TOKEN:'private-test'}),fetcher})()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({source:'webflow',error:'catalog_unavailable'})
  })
  it('rejects malformed and unexpectedly large upstream pages', async () => {
    for(const payload of [{items:[],pagination:{total:2}}, {items:[],pagination:{total:2000}}, {items:[null],pagination:{total:1}}]) {
      const response=await createStyleCatalogHandler({env:()=>({WEBFLOW_CMS_API_TOKEN:'test'}),fetcher:vi.fn(async()=>Response.json(payload))})()
      expect(response.status).toBe(503)
    }
  })
})

describe('published blog synchronization', () => {
  const script=readFileSync(new URL('../public/vora-catalog.js',import.meta.url),'utf8')
  async function blog(catalog: ReturnType<typeof buildStyleCatalog>) {
    const {window}=parseHTML('<html><body><div class="rich-text"><h2>The Essentials for Your Closet</h2><figure class="vora-article-product"><a href="https://old.example">Old item</a></figure><p id="mission">Our mission stays here.</p></div></body></html>')
    const events: Record<string,()=>void>={}
    const timers: Array<()=>void>=[]
    const fetcher=vi.fn(async()=>Response.json(catalog))
    runInNewContext(script,{document:window.document,location:{pathname:'/post/hourglass-edit'},window:{addEventListener:(key:string,fn:()=>void)=>{events[key]=fn},setInterval:(fn:()=>void)=>{timers.push(fn)}},URL,AbortController,setTimeout,clearTimeout,fetch:fetcher})
    await vi.waitFor(()=>expect(window.document.querySelector('[data-vora-catalog-anchor]')).not.toBeNull())
    return {document:window.document,fetcher,events,timers}
  }
  it('updates images, affiliate links and disclosure without interpreting CMS copy as HTML', async()=>{
    const catalog=buildStyleCatalog([product('product-1',{name:'<img src=x onerror=alert(1)>'})],[pick()],[article()])
    const {document}=await blog(catalog)
    const links=Array.from(document.querySelectorAll('figure a'))
    expect(links).toHaveLength(3)
    for(const a of links){expect(a.getAttribute('href')).toBe('https://tracking.example/click?publisher=vora&item=1');expect(a.getAttribute('rel')).toContain('sponsored')}
    expect(document.querySelector('figure img')?.getAttribute('src')).toBe('https://images.example/full-garment.webp')
    expect(document.querySelectorAll('figure img')).toHaveLength(1)
    expect(document.querySelector('figure strong')?.textContent).toContain('<img src=x')
    expect(document.querySelector('[data-vora-affiliate-disclosure]')).not.toBeNull()
    expect(document.querySelector('#mission')?.textContent).toBe('Our mission stays here.')
  })
  it('removes old recommendations when every CMS selection is disabled',async()=>{
    const {document}=await blog(buildStyleCatalog([product()],[pick('p',{active:false})],[article()]))
    expect(document.querySelectorAll('figure')).toHaveLength(0)
    expect(document.querySelector('#mission')).not.toBeNull()
  })
})
