/**
 * Prefix a local asset path with the app's basePath (e.g. `/app` on Webflow
 * Cloud). next/image does NOT apply basePath to a local `src`, so every
 * `<Image>`/`<img>` that points at a `/public` file must wrap its src in this.
 *
 * External URLs (http/https/data) and already-prefixed paths are returned as-is.
 * On Vercel / local dev BASE_PATH is "" so paths are unchanged.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

export function asset(path: string): string {
  if (!path) return path
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path
  if (!path.startsWith('/')) return path
  if (BASE_PATH && path.startsWith(`${BASE_PATH}/`)) return path
  return `${BASE_PATH}${path}`
}
