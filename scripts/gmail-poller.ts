import { google } from 'googleapis'
import fs from 'fs'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://frontend:3041').replace(/\/$/, '')
const WEBHOOK_URL = BASE_URL + '/api/emails/inbound'
const EXTRACT_IMAGE_URL = BASE_URL + '/api/emails/extract-image'
const SYSTEM_EMAIL = (process.env.SMTP_USER || '').toLowerCase()
const POLL_INTERVAL_MS = 60_000
const MAX_PER_RUN = 5
const STATE_FILE = '/data/processed-ids.json'
// How far back to look — 30d tolerates longer planned downtime
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

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
])

interface ImageAttachment {
  filename: string
  mimeType: string
  attachmentId: string
}

/** Walk the MIME tree and collect all image attachment descriptors. */
function collectImageAttachments(payload: any): ImageAttachment[] {
  if (!payload) return []
  const results: ImageAttachment[] = []
  if (IMAGE_TYPES.has(payload.mimeType) && payload.filename && payload.body?.attachmentId) {
    results.push({
      filename: payload.filename,
      mimeType: payload.mimeType,
      attachmentId: payload.body.attachmentId,
    })
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      results.push(...collectImageAttachments(part))
    }
  }
  return results
}

/**
 * Download each image attachment from Gmail, call /api/emails/extract-image
 * for each, and return the concatenated extracted text blocks.
 * Non-fatal: if any attachment fails, it is skipped with a warning.
 */
async function extractTextFromAttachments(
  gmail: Awaited<ReturnType<typeof getGmailClient>>,
  messageId: string,
  attachments: ImageAttachment[],
  senderEmail: string,
  subject: string,
): Promise<string> {
  const blocks: string[] = []

  for (const att of attachments) {
    try {
      console.log(`[Poller] Extracting image: ${att.filename} (${att.mimeType})`)
      const attRes = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: att.attachmentId,
      })
      const base64 = attRes.data.data
      if (!base64) continue

      // Decode Gmail's URL-safe base64 to a Buffer, then create a Blob for FormData
      const buffer = Buffer.from(base64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      const blob = new Blob([buffer], { type: att.mimeType })
      const form = new FormData()
      form.append('image', blob, att.filename)
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
      } else {
        console.warn(`[Poller] Extract-image returned no text for ${att.filename}`)
      }
    } catch (err: any) {
      console.warn(`[Poller] Failed to extract ${att.filename}:`, err?.message || err)
    }
  }

  return blocks.join('\n\n')
}

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
    // Network error or timeout — app is down, will retry next poll
    const msg = err?.name === 'AbortError' ? 'timeout after 30s' : String(err?.message || err)
    return { ok: false, status: 0, text: msg }
  }
}

async function poll() {
  const gmail = await getGmailClient()
  // Secondary dedup guard (state file) — primary dedup is Gmail's is:unread label
  const processed = loadProcessed()

  // is:unread is the key filter — messages we've successfully processed are marked read,
  // so they never appear here again, even if the state file is lost.
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `subject:"Pricing Update Request" newer_than:${LOOKBACK} is:unread`,
    maxResults: MAX_PER_RUN + 10, // fetch a few extras to account for skippable messages
  })

  const messages = res.data.messages || []
  console.log(`[Poller] ${new Date().toISOString()} — ${messages.length} unread candidate(s)`)

  let count = 0
  for (const msg of messages) {
    if (count >= MAX_PER_RUN) break
    if (!msg.id) continue

    // Secondary guard: skip if we already handled this ID in a prior run
    if (processed[msg.id]) {
      console.log(`[Poller] Skip (state file): ${msg.id}`)
      continue
    }

    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'full' })
    const headers = full.data.payload?.headers || []

    const from    = getHeader(headers, 'from')
    const to      = getHeader(headers, 'to')
    const subject = getHeader(headers, 'subject')

    // Skip emails sent by the system itself (replies we send)
    if (SYSTEM_EMAIL && from.toLowerCase().includes(SYSTEM_EMAIL)) {
      console.log(`[Poller] Skip (system email): ${msg.id}`)
      processed[msg.id] = true
      // Mark read so it never shows in is:unread queries
      await gmail.users.messages.modify({
        userId: 'me', id: msg.id!,
        requestBody: { removeLabelIds: ['UNREAD'] },
      }).catch(() => {/* best-effort */})
      continue
    }

    if (!subject.toLowerCase().includes('pricing update request')) {
      processed[msg.id] = true
      continue
    }

    const senderEmail = from.match(/<(.+?)>/)?.[1] || from
    let body = extractBody(full.data.payload)

    // Extract text from any image attachments and append to email body
    const imageAttachments = collectImageAttachments(full.data.payload)
    if (imageAttachments.length > 0) {
      console.log(`[Poller] Found ${imageAttachments.length} image attachment(s) in "${subject}"`)
      const imageText = await extractTextFromAttachments(gmail, msg.id!, imageAttachments, senderEmail, subject)
      if (imageText) body = body ? `${body}\n\n${imageText}` : imageText
    }

    console.log(`[Poller] Processing: "${subject}" from ${from}`)

    const result = await postWebhook({ from, to, subject, text: body, messageId: msg.id })
    console.log(`[Poller] Webhook → ${result.status || 'ERR'} — ${result.text.slice(0, 200)}`)

    if (result.ok) {
      processed[msg.id] = true
      count++
      // Mark as read — this is the primary mechanism that prevents reprocessing.
      // Even if the state file is lost on restart, is:unread will exclude this message.
      await gmail.users.messages.modify({
        userId: 'me',
        id: msg.id!,
        requestBody: { removeLabelIds: ['UNREAD'] },
      })
      console.log(`[Poller] ✓ Done + marked read: ${msg.id}`)
    } else {
      // Message stays UNREAD in Gmail → will be retried automatically next poll.
      // This handles app downtime: once the app recovers, unread messages queue up
      // and get processed in order (up to MAX_PER_RUN per minute).
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
