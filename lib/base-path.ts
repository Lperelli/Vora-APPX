/**
 * Prefix a local asset path with the app's basePath (e.g. `/app` on Webflow
 * Cloud). next/image does NOT apply basePath to a local `src`, so every
 * `<Image>`/`<img>` that points at a `/public` file must wrap its src in this.
 *
 * Resolution order:
 *  1. Build-time env (NEXT_PUBLIC_BASE_PATH) — set this and server + client
 *     agree, with no hydration mismatch. This is the clean path.
 *  2. Runtime fallback — if the build env wasn't baked in (e.g. Webflow Cloud
 *     only injects vars at runtime), detect the prefix in the browser from the
 *     `/_next/` asset URLs the platform DOES serve correctly. This self-heals
 *     the images even without build-time config.
 *
 * On Vercel / local dev nothing is set and detection finds no prefix → "".
 */
export const BUILD_BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

let runtimeBase: string | null = null

function detectRuntimeBase(): string {
  if (typeof document === 'undefined') return ''
  if (runtimeBase !== null) return runtimeBase
  try {
    const el = document.querySelector('script[src*="/_next/"], link[href*="/_next/"]')
    const ref = el?.getAttribute('src') || el?.getAttribute('href') || ''
    const u = new URL(ref, window.location.origin)
    const i = u.pathname.indexOf('/_next/')
    const prefixPath = i > 0 ? u.pathname.slice(0, i) : ''
    // Webflow Cloud serves /_next (and /public) from a separate assets origin,
    // so when _next is cross-origin we point images at that same origin+path.
    // Same-origin (Vercel/local) → just the path (usually "").
    runtimeBase = u.origin !== window.location.origin ? u.origin + prefixPath : prefixPath
  } catch {
    runtimeBase = ''
  }
  return runtimeBase
}

function resolveBase(): string {
  return BUILD_BASE || detectRuntimeBase()
}

export function asset(path: string): string {
  if (!path) return path
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path
  if (!path.startsWith('/')) return path
  const base = resolveBase()
  if (base && path.startsWith(`${base}/`)) return path
  return `${base}${path}`
}
