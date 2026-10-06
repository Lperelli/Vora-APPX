import { validLeadEmail } from "./leads"

const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface LeadDependencies {
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
}

function leadDestination(env: Record<string, string | undefined>): URL | null {
  if (!env.VORA_LEADS_WEBHOOK_URL || !env.VORA_LEADS_WEBHOOK_SECRET) return null
  try {
    const url = new URL(env.VORA_LEADS_WEBHOOK_URL)
    if (url.origin !== 'https://script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) || url.search || url.hash) return null
    return url
  } catch { return null }
}

/** Public availability only: never reveal the destination or credentials. */
export function createLeadStatusHandler(dependencies: LeadDependencies = {}) {
  return async function GET(): Promise<Response> {
    return Response.json({ enabled: !!leadDestination(dependencies.env ?? process.env) }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}

/** Only email and an idempotency key leave the browser. Never accept photo/profile data. */
export function createLeadHandler(dependencies: LeadDependencies = {}) {
  return async function POST(request: Request): Promise<Response> {
    const reply = (status: number, body: object) => Response.json(body, {
      status, headers: { 'Cache-Control': 'no-store' },
    })
    const env = dependencies.env ?? process.env
    const origin = request.headers.get('origin')
    if (origin && origin !== (env.VORA_APP_ORIGIN || new URL(request.url).origin)) {
      return reply(403, { error: 'Request not allowed.' })
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      return reply(415, { error: 'Expected JSON.' })
    }
    if (Number(request.headers.get('content-length')) > 2048) {
      return reply(413, { error: 'Request too large.' })
    }

    let email: string
    let requestId: string
    try {
      const text = await request.text()
      if (text.length > 2048) return reply(413, { error: 'Request too large.' })
      const body: unknown = JSON.parse(text)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid payload')
      const fields = body as Record<string, unknown>
      if (Object.keys(fields).some(key => !['email', 'requestId'].includes(key))) throw new Error('Unexpected data')
      if (typeof fields.email !== 'string' || typeof fields.requestId !== 'string') throw new Error('Missing fields')
      email = fields.email.trim().toLowerCase()
      requestId = fields.requestId
      if (!validLeadEmail(email) || !REQUEST_ID_RE.test(requestId)) throw new Error('Invalid fields')
    } catch {
      return reply(400, { error: 'Please enter a valid email.' })
    }

    const url = leadDestination(env)
    const token = env.VORA_LEADS_WEBHOOK_SECRET
    if (!url || !token) return reply(503, { error: 'Email registration is temporarily unavailable.' })
    try {
      const response = await (dependencies.fetch ?? fetch)(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, requestId, token, source: 'vora-app' }),
        signal: AbortSignal.timeout(12000),
        cache: 'no-store',
        redirect: 'follow',
      })
      const result = await response.json()
      if (!response.ok || result?.ok !== true || result?.requestId !== requestId) throw new Error('Not saved')
      return reply(200, { saved: true })
    } catch {
      // Never log the payload, email, token, or upstream response.
      return reply(502, { error: 'We could not save your email. Please try again.' })
    }
  }
}
