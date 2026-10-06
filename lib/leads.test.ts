import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createLeadHandler, createLeadStatusHandler } from './lead-handler'

const requestId = '136f9ead-9914-40a1-9654-39b33a0a2f00'
const url = 'https://script.google.com/macros/s/test-deployment/exec'
const env = { VORA_LEADS_WEBHOOK_URL: url, VORA_LEADS_WEBHOOK_SECRET: 'test-secret' }
function request(body: unknown = { email: ' Test@Example.com ', requestId }, origin = 'https://vora-blog.webflow.io') {
  return new Request('https://vora-blog.webflow.io/app/api/leads', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
  })
}
afterEach(() => vi.restoreAllMocks())

describe('lead availability', () => {
  it.each([
    {},
    { VORA_LEADS_WEBHOOK_URL: url },
    { ...env, VORA_LEADS_WEBHOOK_URL: 'https://other.example/exec' },
    { ...env, VORA_LEADS_WEBHOOK_URL: `${url}?token=private` },
    { ...env, VORA_LEADS_WEBHOOK_URL: 'not-a-url' },
  ])('keeps the email form disabled without a valid private destination', async settings => {
    const upstream = vi.fn<typeof fetch>()
    const response = await createLeadStatusHandler({ env: settings, fetch: upstream })()
    expect(await response.json()).toEqual({ enabled: false })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(upstream).not.toHaveBeenCalled()
  })
  it('only reveals availability, without returning a secret, destination or lead data', async () => {
    const upstream = vi.fn<typeof fetch>()
    const response = await createLeadStatusHandler({ env, fetch: upstream })()
    expect(await response.json()).toEqual({ enabled: true })
    expect(upstream).not.toHaveBeenCalled()
  })
})

describe('lead registration server', () => {
  it('only confirms a matched saved receipt, normalises email, and sends no profile data', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, requestId }))
    const response = await createLeadHandler({ env, fetch: upstream })(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ saved: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(JSON.parse(upstream.mock.calls[0][1]!.body as string)).toEqual({ email: 'test@example.com', requestId, token: 'test-secret', source: 'vora-app' })
  })
  it.each([
    { email: 'invalid', requestId },
    { email: 'a@example.com', requestId: 'invalid' },
    { email: 'a@example.com', requestId, photo: 'private' },
    { email: 'a\u0000@example.com', requestId },
    null,
  ])('rejects invalid or excessive fields without forwarding them', async body => {
    const upstream = vi.fn<typeof fetch>()
    expect((await createLeadHandler({ env, fetch: upstream })(request(body))).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('rejects requests from another origin and oversized requests', async () => {
    const upstream = vi.fn<typeof fetch>()
    const handler = createLeadHandler({ env, fetch: upstream })
    expect((await handler(request(undefined, 'https://elsewhere.example'))).status).toBe(403)
    expect((await handler(request({ email: 'a'.repeat(3000), requestId }))).status).toBe(413)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('does not save or unlock when configuration is missing or points outside Google', async () => {
    const upstream = vi.fn<typeof fetch>()
    for (const settings of [{}, { ...env, VORA_LEADS_WEBHOOK_URL: 'https://other.example/exec' }]) {
      expect((await createLeadHandler({ env: settings, fetch: upstream })(request())).status).toBe(503)
    }
    expect(upstream).not.toHaveBeenCalled()
  })
  it.each([{ ok: false }, { ok: true, requestId: 'wrong-id' }])('does not treat HTTP 200 as proof of persistence', async body => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
    expect((await createLeadHandler({ env, fetch: upstream })(request())).status).toBe(502)
  })
  it('handles timeout and unexpected upstream HTML without exposing private values', async () => {
    for (const upstream of [
      vi.fn<typeof fetch>().mockRejectedValue(new Error('contains test-secret')),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>sign in</html>')),
    ]) {
      const response = await createLeadHandler({ env, fetch: upstream })(request())
      expect(response.status).toBe(502)
      expect(await response.text()).not.toContain('test-secret')
    }
  })
})

/** In-memory Sheets contract: exercise the actual deployed script, including deduplication. */
function receiver() {
  const rows: unknown[][] = [['Email', 'Fecha de registro (UTC)', 'Origen', 'ID de solicitud']]
  const open = vi.fn()
  const flush = vi.fn()
  const releaseLock = vi.fn()
  const tryLock = vi.fn().mockReturnValue(true)
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    getRange: (row: number, column: number, count = 1, width = 1) => ({
      getValues: () => rows.slice(row - 1, row - 1 + count).map(values => values.slice(column - 1, column - 1 + width)),
      getDisplayValue: () => String(rows[row - 1][column - 1]).replace(/^'/, ''),
      setValues: (values: unknown[][]) => { rows[row - 1] = values[0]; return {} },
      setNumberFormat: vi.fn(),
      createTextFinder: (value: string) => {
        const finder = {
          matchEntireCell: () => finder,
          matchCase: () => finder,
          findNext: () => {
            const index = rows.findIndex((values, index) => index >= row - 1 && String(values[column - 1]).replace(/^'/, '').toLowerCase() === value.toLowerCase())
            return index < 0 ? null : { getRow: () => index + 1 }
          },
        }
        return finder
      },
    }),
  }
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => ({ LEADS_SECRET: 'test-secret', LEADS_SHEET_ID: 'test-sheet' })[key] }) },
    SpreadsheetApp: { openById: open.mockReturnValue({ getSheetByName: () => sheet, getSpreadsheetTimeZone: () => 'Etc/UTC' }), flush },
    LockService: { getScriptLock: () => ({ tryLock, hasLock: () => true, releaseLock }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (value: string) => ({ setMimeType: () => JSON.parse(value) }) },
  }
  const source = readFileSync(new URL('../integrations/google-sheets/Code.gs', import.meta.url), 'utf8')
  const post = runInNewContext(`${source}\ndoPost`, context) as (event: object) => { ok: boolean; requestId?: string }
  const send = (body: object) => post({ postData: { contents: JSON.stringify(body) } })
  const payload = { email: 'test@example.com', requestId, token: 'test-secret', source: 'vora-app' }
  return { send, payload, rows, open, flush, tryLock, releaseLock }
}

describe('Google Sheets receiver', () => {
  it('writes once across retries and repeated emails, with an actual date', () => {
    const script = receiver()
    expect(script.send(script.payload)).toEqual({ ok: true, requestId })
    expect(script.send(script.payload)).toEqual({ ok: true, requestId })
    const nextId = '236f9ead-9914-40a1-9654-39b33a0a2f00'
    expect(script.send({ ...script.payload, email: 'TEST@EXAMPLE.COM', requestId: nextId })).toEqual({ ok: true, requestId: nextId })
    expect(script.rows).toHaveLength(2)
    expect(Object.prototype.toString.call(script.rows[1][1])).toBe('[object Date]')
    expect(script.flush).toHaveBeenCalledOnce()
    expect(script.releaseLock).toHaveBeenCalledTimes(3)
  })
  it('rejects a mismatched retry, wrong secret and busy writer without adding a row', () => {
    const script = receiver()
    expect(script.send({ ...script.payload, token: 'wrong' }).ok).toBe(false)
    expect(script.open).not.toHaveBeenCalled()
    script.send(script.payload)
    expect(script.send({ ...script.payload, email: 'different@example.com' }).ok).toBe(false)
    script.tryLock.mockReturnValue(false)
    expect(script.send({ ...script.payload, requestId: '336f9ead-9914-40a1-9654-39b33a0a2f00' }).ok).toBe(false)
    expect(script.rows).toHaveLength(2)
  })
  it('treats formula-like addresses as literal text and does not confirm a failed flush', () => {
    const script = receiver()
    script.flush.mockImplementation(() => { throw new Error('write failed') })
    expect(script.send({ ...script.payload, email: '=test@example.com' }).ok).toBe(false)
    expect(script.rows[1][0]).toBe("'=test@example.com")
    expect(script.releaseLock).toHaveBeenCalledOnce()
  })
})
