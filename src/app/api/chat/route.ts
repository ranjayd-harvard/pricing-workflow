import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import dbConnect from '@/lib/db'
import { PricingTemplateModel } from '@/models/PricingTemplate'
import { PricingQueueModel } from '@/models/PricingQueue'
import { sendEmail, buildConfirmationEmail } from '@/lib/email'
import { checkMandatoryFields } from '@/lib/fieldExtractor'
import {
  classifyEmailToTemplate,
  summarizeEmailWithGemini,
  mapToPricingTemplate,
  TemplateCandidate,
} from '@/lib/gemini'
import { TemplateField } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConversationState {
  phase: 'intent' | 'fields' | 'email' | 'done'
  templateId?: string
  templateName?: string
  templateFields?: TemplateField[]
  collectedFields: Record<string, string | number | null>
  missingFields: string[]   // field *keys* still needed
  userName?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  conversationState: ConversationState
}

interface ChatResponse {
  reply: string
  conversationState: ConversationState
  done?: boolean
}

// ── Gemini helper: extract field values from a short chat message ──────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

async function extractFieldValues(
  userMessage: string,
  fields: TemplateField[],
): Promise<Record<string, string | number>> {
  if (!fields.length) return {}

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const fieldList = fields
    .map(f => {
      let line = `- key="${f.key}" label="${f.label}" type="${f.type}"`
      if (f.options?.length) line += ` options=[${f.options.join(', ')}]`
      if (f.description) line += ` hint="${f.description}"`
      if (f.example) line += ` example="${f.example}"`
      return line
    })
    .join('\n')

  const prompt = `You are extracting values from a user's chat reply in a pricing update wizard.

FIELDS TO EXTRACT (use the exact key strings listed):
${fieldList}

USER REPLY:
"${userMessage}"

Rules:
- Return a JSON object where keys match the field key strings above exactly.
- Only include keys where you are confident a value was provided.
- Do NOT invent values. If a field is not mentioned, omit the key entirely.
- For type=currency or type=number: return a plain number (no currency symbols, no commas).
- For type=date: return ISO-8601 format (YYYY-MM-DD).
- For type=select: match the closest option exactly (case-insensitive).
- For type=string: return the value as-is.

Respond with ONLY valid JSON, no markdown fences, no explanation.`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return {}
  }
}

// ── Helper: build a question listing all missing fields at once ───────────────

function buildFieldsQuestion(fields: TemplateField[]): string {
  if (fields.length === 1) {
    const f = fields[0]
    let q = `Just one more — **${f.label}**`
    if (f.description) q += ` (${f.description})`
    q += '?'
    if (f.options?.length) q += `\nOptions: ${f.options.join(', ')}`
    if (f.example) q += `\nExample: ${f.example}`
    return q
  }

  const lines = fields.map(f => {
    let line = `• **${f.label}**`
    if (f.description) line += ` — ${f.description}`
    if (f.options?.length) line += ` (options: ${f.options.join(', ')})`
    if (f.example) line += ` e.g. ${f.example}`
    return line
  })

  return `Please provide the following details (you can share all at once or a few at a time):\n\n${lines.join('\n')}`
}

// ── Phase handlers ───────────────────────────────────────────────────────────

async function handleIntentPhase(
  messages: ChatMessage[],
  state: ConversationState,
): Promise<NextResponse<ChatResponse>> {
  const emailBody = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n\n')

  const allTemplates = await PricingTemplateModel.find({ active: true })

  if (!allTemplates.length) {
    return NextResponse.json({
      reply: "I'm sorry, there are no active pricing templates configured right now. Please contact your administrator.",
      conversationState: state,
    })
  }

  let resolvedTemplate: (typeof allTemplates)[0] | null = null

  if (allTemplates.length === 1) {
    resolvedTemplate = allTemplates[0]
  } else {
    const candidates: TemplateCandidate[] = allTemplates.map(t => ({
      templateId: String(t._id),
      templateName: t.name,
      description: t.description,
    }))

    const { matchedTemplateId, confidence, reasoning } = await classifyEmailToTemplate(
      emailBody,
      'Pricing Update Request',
      candidates,
    )
    console.log(`[Chat] Template classification: id=${matchedTemplateId} confidence=${confidence} — ${reasoning}`)

    if (matchedTemplateId && (confidence === 'high' || confidence === 'medium')) {
      resolvedTemplate = allTemplates.find(t => String(t._id) === matchedTemplateId) || null
    }

    if (!resolvedTemplate) {
      const optionList = allTemplates
        .map((t, i) => `${i + 1}. **${t.name}** — ${t.description}`)
        .join('\n')
      return NextResponse.json({
        reply: `I want to make sure I help you with the right type of request. Could you clarify which of these applies?\n\n${optionList}`,
        conversationState: state,
      })
    }
  }

  // Template resolved — pre-populate any fields the user already mentioned
  const mandatoryFields = resolvedTemplate.mandatoryFields as TemplateField[]
  const { missingFields: missingLabels } = checkMandatoryFields(emailBody, mandatoryFields)

  // Extract values for fields that appear to be present already
  const alreadyMentionedFields = mandatoryFields.filter(
    f => f.required && !missingLabels.includes(f.label),
  )
  const prePopulated = alreadyMentionedFields.length
    ? await extractFieldValues(emailBody, alreadyMentionedFields)
    : {}

  const collectedFields: Record<string, string | number | null> = { ...prePopulated }
  const missingFieldKeys = mandatoryFields
    .filter(f => f.required && collectedFields[f.key] == null)
    .map(f => f.key)

  const newState: ConversationState = {
    ...state,
    phase: 'fields',
    templateId: String(resolvedTemplate._id),
    templateName: resolvedTemplate.name,
    templateFields: mandatoryFields,
    collectedFields,
    missingFields: missingFieldKeys,
  }

  if (missingFieldKeys.length === 0) {
    // User somehow provided everything in the opening — move straight to email
    newState.phase = 'email'
    return NextResponse.json({
      reply: `Great, I'll help you with a **${resolvedTemplate.name}** update — and you've already given me everything I need!\n\nFinally, what email address should I send the confirmation to?`,
      conversationState: newState,
    })
  }

  const missingFieldDefs = missingFieldKeys
    .map(key => mandatoryFields.find(f => f.key === key))
    .filter((f): f is TemplateField => f != null)

  const totalRequired = mandatoryFields.filter(f => f.required).length
  const alreadyHave = totalRequired - missingFieldKeys.length

  let reply = `Got it — I'll help you with a **${resolvedTemplate.name}** update.`
  if (alreadyHave > 0) {
    reply += ` I already picked up ${alreadyHave} field${alreadyHave > 1 ? 's' : ''} from your message.`
  }
  reply += `\n\n${buildFieldsQuestion(missingFieldDefs)}`

  return NextResponse.json({ reply, conversationState: newState })
}

async function handleFieldsPhase(
  messages: ChatMessage[],
  state: ConversationState,
): Promise<NextResponse<ChatResponse>> {
  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''
  const templateFields = (state.templateFields || []) as TemplateField[]

  // Get full TemplateField objects for all currently missing keys
  const missingFieldDefs = state.missingFields
    .map(key => templateFields.find(f => f.key === key))
    .filter((f): f is TemplateField => f != null)

  // Extract values from the latest message
  const extracted = await extractFieldValues(latestUserMessage, missingFieldDefs)

  // Merge into collectedFields
  const updatedCollected = { ...state.collectedFields, ...extracted }

  // Recompute missing: mandatory fields where collected value is still null/undefined
  const stillMissing = templateFields
    .filter(f => f.required && updatedCollected[f.key] == null)
    .map(f => f.key)

  const newState: ConversationState = {
    ...state,
    collectedFields: updatedCollected,
    missingFields: stillMissing,
  }

  if (stillMissing.length > 0) {
    const stillMissingDefs = stillMissing
      .map(key => templateFields.find(f => f.key === key))
      .filter((f): f is TemplateField => f != null)

    const totalRequired = templateFields.filter(f => f.required).length
    const haveNow = totalRequired - stillMissing.length

    let reply = Object.keys(extracted).length > 0 ? `Got it.` : `I still need a few more details.`
    if (haveNow > 0) {
      reply += ` (${haveNow} of ${totalRequired} collected)`
    }
    reply += `\n\n${buildFieldsQuestion(stillMissingDefs)}`

    return NextResponse.json({ reply, conversationState: newState })
  }

  // All mandatory fields collected — move to email phase
  newState.phase = 'email'
  return NextResponse.json({
    reply: "All set — I have everything I need.\n\nFinally, what email address should I send the confirmation to?",
    conversationState: newState,
  })
}

async function handleEmailPhase(
  messages: ChatMessage[],
  state: ConversationState,
): Promise<NextResponse<ChatResponse>> {
  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''

  const emailMatch = latestUserMessage.match(/[\w.+-]+@[\w.-]+\.\w+/)
  if (!emailMatch) {
    return NextResponse.json({
      reply: "That doesn't look like a valid email address. Could you double-check and try again?",
      conversationState: state,
    })
  }

  const emailAddress = emailMatch[0].toLowerCase()

  // Build threadText from all user messages
  const threadText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n\n---\n\n')

  // Fetch full template (need optionalFields for mapping)
  const template = await PricingTemplateModel.findById(state.templateId)
  if (!template) {
    return NextResponse.json({
      reply: "Something went wrong — I couldn't find the template. Please start a new conversation.",
      conversationState: state,
    })
  }

  const allFields = [
    ...(template.mandatoryFields as TemplateField[]),
    ...(template.optionalFields as TemplateField[] || []),
  ]

  // Summarize and map
  const { summary, extractedData } = await summarizeEmailWithGemini(
    threadText,
    template.name,
    template.mandatoryFields as TemplateField[],
  )
  const mappedData = mapToPricingTemplate(extractedData, summary, allFields)

  const subject = `Pricing Update Request — ${template.name} (via Chat)`

  // Create queue item
  const queueItem = await PricingQueueModel.create({
    templateId: state.templateId,
    templateName: template.name,
    requesterEmail: emailAddress,
    requesterName: state.userName || 'Chat User',
    subject,
    originalEmailBody: threadText,
    emailThread: [{
      from: emailAddress,
      to: 'chat@pricing-workflow',
      subject,
      body: threadText,
      timestamp: new Date().toISOString(),
      messageId: `chat-${Date.now()}`,
    }],
    missingFields: [],
    extractedData,
    summary,
    mappedData,
    status: 'pending_confirmation',
    geminiLog: { intent: 'new_request', intentConfidence: 'high', intentReasoning: 'Collected via guided chat' },
  })

  // Send confirmation email
  await sendEmail({
    to: emailAddress,
    subject: `Re: ${subject} — Please Confirm Your Pricing Request`,
    html: buildConfirmationEmail(
      state.userName || 'there',
      subject,
      summary,
      mappedData as Record<string, string | number | null>,
    ),
  })

  const newState: ConversationState = { ...state, phase: 'done' }

  // Build field summary for the success message
  const fieldSummary = Object.entries(state.collectedFields)
    .filter(([, v]) => v != null)
    .map(([key, value]) => {
      const field = (state.templateFields || []).find(f => f.key === key)
      const label = field?.label || key
      return `• ${label}: ${value}`
    })
    .join('\n')

  const reply = [
    `Your request has been submitted and a confirmation email is on its way to **${emailAddress}**.`,
    '',
    `Here's a summary of what I've captured:\n${fieldSummary}`,
    '',
    "You'll receive an email shortly. Just reply to confirm and your request will move to the approval queue.",
  ].join('\n')

  console.log(`[Chat] Queue item created: ${queueItem._id} for ${emailAddress}`)

  return NextResponse.json({ reply, conversationState: newState, done: true })
}

// ── Main route handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<ChatResponse>> {
  let state: ConversationState = { phase: 'intent', collectedFields: {}, missingFields: [] }
  let messages: ChatMessage[] = []

  try {
    await dbConnect()

    const body: ChatRequest = await req.json()
    messages = body.messages

    state = {
      ...body.conversationState,
      phase: body.conversationState?.phase ?? 'intent',
      collectedFields: body.conversationState?.collectedFields ?? {},
      missingFields: body.conversationState?.missingFields ?? [],
    }

    switch (state.phase) {
      case 'intent':
        return handleIntentPhase(messages, state)
      case 'fields':
        return handleFieldsPhase(messages, state)
      case 'email':
        return handleEmailPhase(messages, state)
      default:
        return NextResponse.json({
          reply: 'This conversation is complete. Click "New Conversation" to start another request.',
          conversationState: state,
          done: true,
        })
    }
  } catch (err) {
    console.error('[Chat API]', err)
    return NextResponse.json({
      reply: 'Something went wrong on my end — please try again.',
      conversationState: state,
    })
  }
}
