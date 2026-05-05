import { google } from 'googleapis'
import fs from 'fs'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://frontend:3041').replace(/\/$/, '')
const WEBHOOK_URL = BASE_URL + '/api/emails/inbound'
const EXTRACT_IMAGE_URL = BASE_URL + '/api/emails/extract-image'
const EXTRACT_SPREADSHEET_URL = BASE_URL + '/api/emails/extract-spreadsheet'
const SYSTEM_EMAIL = (process.env.SMTP_USER || '').toLowerCase()
const POLL_INTERVAL_MS = 60_000
const MAX_PER_RUN = 5
const STATE_FILE = '/data/processed-ids.json'
const LOOKBACK = '30d'

function loadProcessed(): Record<string, boolean> {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch { return {} }
}

function saveProcessed(data: Record<string, boolean>) {
  fs.mkdirSync('/data', { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(data))
}

async function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth })
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function getHeader(headers: { name?: string | null; value?: string | null }[], name: string): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

function extractBody(payload: any): string {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64(payload.body.data)
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const found = extractBody(part)
      if (found) return found
    }
  }
  return ''
}

function fileExtension(filename: string): string {
  const m = filename.toLowerCase().match(/\.[^.]+$/)
  return m ? m[0] : ''
}

// ── Attachment type sets ────────────────────────────────────────────────────

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
])

const SPREADSHEET_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
])
const SPREADSHEET_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls'])

interface Attachment {
  filename: string
  mimeType: string
  attachmentId: string
}

// ── MIME tree walkers ───────────────────────────────────────────────────────

function collectImageAttachments(payload: any): Attachment[] {
  if (!payload) return []
  const results: Attachment[] = []
  if (IMAGE_TYPES.has(payload.mimeType) && payload.filename && payload.body?.attachmentId) {
    results.push({ filename: payload.filename, mimeType: payload.mimeType, attachmentId: payload.body.attachmentId })
  }
  if (payload.parts) {
    for (const part of payload.parts) results.push(...collectImageAttachments(part))
  }
  return results
}

function collectSpreadsheetAttachments(payload: any): Attachment[] {
  if (!payload) return []
  const results: Attachment[] = []
  if (payload.filename && payload.body?.attachmentId) {
    const isType = SPREADSHEET_TYPES.has(payload.mimeType)
    const isExt = SPREADSHEET_EXTENSIONS.has(fileExtension(payload.filename))
    if (isType || isExt) {
      results.push({ filename: payload.filename, mimeType: payload.mimeType, attachmentId: payload.body.attachmentId })
    }
  }
  if (payload.parts) {
    for (const part of payload.parts) results.push(...collectSpreadsheetAttachments(part))
  }
  return results
}

// ── Attachment downloaders ──────────────────────────────────────────────────

type GmailClient = Awaited<ReturnType<typeof getGmailClient>>

async function downloadAttachment(gmail: GmailClient, messageId: string, att: Attachment): Promise<Buffer | null> {
  const attRes = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: att.attachmentId })
  const base64 = attRes.data.data
  if (!base64) return null
  return Buffer.from(base64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

async function extractFromImages(
  gmail: GmailClient, messageId: string, attachments: Attachment[], senderEmail: string, subject: string,
): Promise<string> {
  const blocks: string[] = []
  for (const att of attachments) {
    try {
      console.log(`[Poller] Extracting image: ${att.filename}`)
      const buffer = await downloadAttachment(gmail, messageId, att)
      if (!buffer) continue
      const form = new FormData()
      form.append('image', new Blob([new Uint8Array(buffer)], { type: att.mimeType }), att.filename)
      form.append('senderEmail', senderEmail)
      form.append('subject', subject)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)
      const res = await fetch(EXTRACT_IMAGE_URL, { method: 'POST', body: form, signal: controller.signal })
      clearTimeout(timeout)
      const json = await res.json() as { success: boolean; data?: { extractedText: string } }
      if (json.success && json.data?.extractedText) {
        blocks.push(`[Extracted from image: ${att.filename}]\n${json.data.extractedText}`)
        console.log(`[Poller] ✓ Image extracted: ${att.filename}`)
      }
    } catch (err: any) {
      console.warn(`[Poller] Failed to extract image ${att.filename}:`, err?.message || err)
    }
  }
  return blocks.join('\n\n')
}

async function extractFromSpreadsheets(
  gmail: GmailClient, messageId: string, attachments: Attachment[], senderEmail: string, subject: string,
): Promise<string> {
  const blocks: string[] = []
  for (const att of attachments) {
    try {
      console.log(`[Poller] Extracting spreadsheet: ${att.filename}`)
      const buffer = await downloadAttachment(gmail, messageId, att)
      if (!buffer) continue
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(buffer)], { type: att.mimeType || 'application/octet-stream' }), att.filename)
      form.append('senderEmail', senderEmail)
      form.append('subject', subject)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)
      const res = await fetch(EXTRACT_SPREADSHEET_URL, { method: 'POST', body: form, signal: controller.signal })
      clearTimeout(timeout)
      const json = await res.json() as { success: boolean; data?: { extractedText: string } }
      if (json.success && json.data?.extractedText) {
        blocks.push(`[Extracted from spreadsheet: ${att.filename}]\n${json.data.extractedText}`)
        console.log(`[Poller] ✓ Spreadsheet extracted: ${att.filename}`)
      }
    } catch (err: any) {
      console.warn(`[Poller] Failed to extract spreadsheet ${att.filename}:`, err?.message || err)
    }
  }
  return blocks.join('\n\n')
}

// ── Webhook ─────────────────────────────────────────────────────────────────

async function postWebhook(payload: object): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const text = await response.text()
    return { ok: response.ok, status: response.status, text }
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'timeout after 30s' : String(err?.message || err)
    return { ok: false, status: 0, text: msg }
  }
}

// ── Poll loop ────────────────────────────────────────────────────────────────

async function poll() {
  const gmail = await getGmailClient()
  const processed = loadProcessed()

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `subject:"Pricing Update Request" newer_than:${LOOKBACK} is:unread`,
    maxResults: MAX_PER_RUN + 10,
  })

  const messages = res.data.messages || []
  console.log(`[Poller] ${new Date().toISOString()} — ${messages.length} unread candidate(s)`)

  let count = 0
  for (const msg of messages) {
    if (count >= MAX_PER_RUN) break
    if (!msg.id) continue
    if (processed[msg.id]) { console.log(`[Poller] Skip (state file): ${msg.id}`); continue }

    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'full' })
    const headers = full.data.payload?.headers || []
    const from    = getHeader(headers, 'from')
    const to      = getHeader(headers, 'to')
    const subject = getHeader(headers, 'subject')

    if (SYSTEM_EMAIL && from.toLowerCase().includes(SYSTEM_EMAIL)) {
      console.log(`[Poller] Skip (system email): ${msg.id}`)
      processed[msg.id] = true
      await gmail.users.messages.modify({ userId: 'me', id: msg.id!, requestBody: { removeLabelIds: ['UNREAD'] } }).catch(() => {})
      continue
    }

    if (!subject.toLowerCase().includes('pricing update request')) {
      processed[msg.id] = true
      continue
    }

    const senderEmail = from.match(/<(.+?)>/)?.[1] || from
    let body = extractBody(full.data.payload)

    // Extract text from image attachments
    const imageAtts = collectImageAttachments(full.data.payload)
    if (imageAtts.length > 0) {
      console.log(`[Poller] Found ${imageAtts.length} image attachment(s)`)
      const text = await extractFromImages(gmail, msg.id!, imageAtts, senderEmail, subject)
      if (text) body = body ? `${body}\n\n${text}` : text
    }

    // Extract text from spreadsheet attachments
    const sheetAtts = collectSpreadsheetAttachments(full.data.payload)
    if (sheetAtts.length > 0) {
      console.log(`[Poller] Found ${sheetAtts.length} spreadsheet attachment(s)`)
      const text = await extractFromSpreadsheets(gmail, msg.id!, sheetAtts, senderEmail, subject)
      if (text) body = body ? `${body}\n\n${text}` : text
    }

    console.log(`[Poller] Processing: "${subject}" from ${from}`)
    const result = await postWebhook({ from, to, subject, text: body, messageId: msg.id })
    console.log(`[Poller] Webhook → ${result.status || 'ERR'} — ${result.text.slice(0, 200)}`)

    if (result.ok) {
      processed[msg.id] = true
      count++
      await gmail.users.messages.modify({ userId: 'me', id: msg.id!, requestBody: { removeLabelIds: ['UNREAD'] } })
      console.log(`[Poller] ✓ Done + marked read: ${msg.id}`)
    } else {
      console.error(`[Poller] ✗ Webhook failed — message stays unread, will retry next poll`)
    }
  }

  saveProcessed(processed)
}

async function run() {
  console.log(`[Poller] Starting — polling every ${POLL_INTERVAL_MS / 1000}s, max ${MAX_PER_RUN}/run, lookback ${LOOKBACK}`)
  console.log(`[Poller] Webhook target: ${WEBHOOK_URL}`)
  console.log(`[Poller] System email (skip filter): ${SYSTEM_EMAIL || '(none)'}`)

  while (true) {
    try {
      await poll()
    } catch (e) {
      console.error('[Poller] Unexpected error:', e)
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
}

run()
