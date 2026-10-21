'use client'

import { useEffect, useState } from 'react'
import { BUILD_BASE } from './base-path'
import type { StyleCatalog } from './style-catalog'
import { StyleProductSchema, BODY_TYPE_IDS } from './body-type-analysis'

export function useStyleCatalog() {
  const [catalog, setCatalog] = useState<StyleCatalog | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let controller: AbortController | undefined
    let active = true
    let running = false
    let lastAttempt = 0
    async function load() {
      if (running || !active || Date.now() - lastAttempt < 30_000) return
      running = true
      lastAttempt = Date.now()
      setError(false)
      const requestController = new AbortController()
      controller = requestController
      const timeout = setTimeout(() => requestController.abort(), 12_000)
      try {
        const response = await fetch(`${BUILD_BASE}/api/catalog`, { signal: requestController.signal, credentials: 'omit' })
        if (!response.ok) throw new Error('Catalog unavailable')
        const value = await response.json()
        if (value.version !== 1 || !['webflow', 'bundled'].includes(value.source) || !value.byBodyType || !value.articlesByBodyType) throw new Error('Invalid catalog')
        for (const bodyType of BODY_TYPE_IDS) {
          const items = value.byBodyType[bodyType]
          if (!Array.isArray(items) || items.length > 5 || items.some(item => !StyleProductSchema.safeParse(item).success)) throw new Error('Invalid picks')
        }
        if (active) setCatalog(value)
      } catch {
        if (active) { setCatalog(null); setError(true) }
      } finally { clearTimeout(timeout); running = false }
    }
    const refresh = () => { if (document.visibilityState === 'visible') void load() }
    void load()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = setInterval(refresh, 120_000)
    return () => { active = false; clearInterval(timer); controller?.abort(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [attempt])
  return { catalog, error, retry: () => setAttempt(value => value + 1) }
}
