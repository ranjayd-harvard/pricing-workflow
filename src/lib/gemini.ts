import { GoogleGenerativeAI } from '@google/generative-ai'
import { TemplateField, MappedPricingData } from '@/types'

export interface TemplateCandidate {
  templateId: string
  templateName: string
  description: string
}

export interface TemplateClassificationResult {
  matchedTemplateId: string | null  // null = cannot determine
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

/**
 * Given a list of active templates and the full email thread, asks Gemini to
 * decide which template the sender intends to use.
 *
 * Returns matchedTemplateId=null when confidence is too low to proceed —
 * the caller should then send a clarification email to the requester.
 */
export async function classifyEmailToTemplate(
  emailBody: string,
  subject: string,
  candidates: TemplateCandidate[],
): Promise<TemplateClassificationResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const candidateList = candidates
    .map((c, i) => `${i + 1}. ID="${c.templateId}" | Name="${c.templateName}" | Description="${c.description}"`)
    .join('\n')

  const prompt = `You are a routing assistant for a pricing update workflow. Multiple pricing templates are registered to the same inbox. Your job is to read the email and decide which template the sender is trying to use.

AVAILABLE TEMPLATES:
${candidateList}

EMAIL SUBJECT: "${subject}"

EMAIL BODY:
---
${emailBody}
---

Rules:
- Pick the template whose name/description best matches the purpose and content of the email.
- If the email clearly refers to events, tickets, venues → match the event template.
- If the email refers to products, SKUs, inventory → match the product template.
- Only return matchedTemplateId=null if the email is genuinely ambiguous and you cannot determine intent even with careful reading.
- Confidence "high": unmistakable match. "medium": reasonable match with minor ambiguity. "low": guessing.
- If confidence is "low", set matchedTemplateId to null so the system can ask the sender to clarify.

Respond with ONLY a valid JSON object:
{
  "matchedTemplateId": "<template id string> or null",
  "confidence": "high" | "medium" | "low",
  "reasoning": "one sentence explanation"
}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const confidence: 'high' | 'medium' | 'low' = parsed.confidence || 'low'
    return {
      matchedTemplateId: confidence === 'low' ? null : (parsed.matchedTemplateId || null),
      confidence,
      reasoning: parsed.reasoning || '',
    }
  } catch {
    return { matchedTemplateId: null, confidence: 'low', reasoning: 'Parse error — cannot classify' }
  }
}

export type EmailIntent =
  | 'new_request'        // Fresh pricing request — create new queue item
  | 'reply_missing_info' // Providing missing fields for an existing pending_info item
  | 'correction'         // Correcting/amending a previous request — create new, cancel old

export interface IntentResult {
  intent: EmailIntent
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

/**
 * Uses Gemini to detect the intent of an inbound email.
 * Determines whether it's a new request, a reply providing missing info,
 * or a correction to a previous submission.
 */
export async function detectEmailIntent(
  emailBody: string,
  subject: string,
  hasPendingInfoItem: boolean,
): Promise<IntentResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are an email intent classifier for a pricing update workflow system.

Classify the following email into exactly one of these intents:
- "new_request": A fresh, standalone pricing update request
- "reply_missing_info": The sender is replying to provide missing fields that were previously requested
- "correction": The sender is correcting or amending a previously submitted request (e.g. wrong price, mistake, update to a prior submission)

CONTEXT:
- Subject: "${subject}"
- Subject starts with "Re:": ${subject.toLowerCase().startsWith('re:') ? 'YES' : 'NO'}
- There is an existing PENDING request from this sender awaiting missing info: ${hasPendingInfoItem ? 'YES' : 'NO'}

EMAIL BODY:
---
${emailBody}
---

Signals to look for:
- "correction" intent: phrases like "wrong price", "mistake", "correction", "actually", "should be", "meant to say", "last update was not correct", "please update", "previous request", "instead of"
- "reply_missing_info" intent: providing only specific field values, short reply, responds to a request for missing info
- "new_request" intent: full standalone email with complete request details, no references to previous submissions

Respond with ONLY a valid JSON object:
{
  "intent": "new_request" | "reply_missing_info" | "correction",
  "confidence": "high" | "medium" | "low",
  "reasoning": "one sentence explanation"
}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      intent: parsed.intent || 'new_request',
      confidence: parsed.confidence || 'low',
      reasoning: parsed.reasoning || '',
    }
  } catch {
    // Default: if subject has Re: and there's a pending item → reply, else new
    return {
      intent: hasPendingInfoItem && subject.toLowerCase().startsWith('re:')
        ? 'reply_missing_info'
        : 'new_request',
      confidence: 'low',
      reasoning: 'Fallback classification due to parse error',
    }
  }
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function summarizeEmailWithGemini(
  emailBody: string,
  templateName: string,
  fields: TemplateField[]
): Promise<{ summary: string; extractedData: MappedPricingData }> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const fieldDescriptions = fields
    .map(f => `- ${f.key} (${f.label}): ${f.type}${f.description ? ` — ${f.description}` : ''}`)
    .join('\n')

  const prompt = `You are a pricing workflow assistant. Analyze the following email for a pricing update request.

TEMPLATE: ${templateName}

REQUIRED FIELDS TO EXTRACT:
${fieldDescriptions}

EMAIL CONTENT:
---
${emailBody}
---

Please respond with ONLY a valid JSON object (no markdown, no extra text) in this exact format:
{
  "summary": "A concise 2-3 sentence summary of the pricing update request",
  "extractedData": {
    "fieldKey": "extracted value or null if not found"
  }
}

Extract ALL the field values you can find in the email. Use null for fields not mentioned. Numbers should be numbers (not strings). Dates should be ISO format strings.`

  const result = await model.generateContent(prompt)
  const response = result.response
  const text = response.text()

  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return {
      summary: parsed.summary || 'No summary generated.',
      extractedData: parsed.extractedData || {},
    }
  } catch {
    return {
      summary: text.slice(0, 500),
      extractedData: {},
    }
  }
}

export async function mapToPricingTemplate(
  extractedData: MappedPricingData,
  summary: string,
  templateFields: TemplateField[]
): Promise<MappedPricingData> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are a pricing system integration assistant. Map the following extracted email data to a clean pricing API payload.

TEMPLATE FIELDS:
${templateFields.map(f => `- ${f.key}: ${f.type}${f.required ? ' (required)' : ' (optional)'}`).join('\n')}

EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

SUMMARY:
${summary}

Respond with ONLY a valid JSON object (no markdown) representing the final mapped pricing payload. Ensure types match the field definitions. For numbers, return numeric values. For dates, use ISO strings.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    return extractedData
  }
}
