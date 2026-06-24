/**
 * Webflow Cloud mounts the app under a sub-path (e.g. `/app`), so every asset
 * and route must be prefixed with that path or images/JS 404.
 *
 * basePath is resolved at BUILD time from an env var:
 *  - WEBFLOW_CLOUD_BASE_PATH  → injected by Webflow Cloud with the mount path.
 *  - NEXT_PUBLIC_BASE_PATH     → manual override (set "/app" in Webflow Cloud
 *                                env vars if the auto one isn't present).
 *  - unset (Vercel / local dev) → "" → app served from the root, unchanged.
 */
const basePath = process.env.WEBFLOW_CLOUD_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Expose the resolved prefix to client code so we can prepend it to
  // next/image srcs (next/image does NOT apply basePath to local srcs).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
