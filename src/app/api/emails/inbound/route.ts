import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { PricingTemplateModel } from '@/models/PricingTemplate'
import { PricingQueueModel } from '@/models/PricingQueue'
import { sendEmail, buildMissingFieldsEmail, buildClarificationEmail } from '@/lib/email'
import { checkMandatoryFields, extractSenderName, extractEmailAddress } from '@/lib/fieldExtractor'
import {
  summarizeEmailWithGemini,
  mapToPricingTemplate,
  detectEmailIntent,
  classifyEmailToTemplate,
  TemplateCandidate,
} from '@/lib/gemini'
import { ApiResponse } from '@/types'

/**
 * POST /api/emails/inbound
 * Processes an incoming email pricing request.
 *
 * Template routing logic:
 *  1 template  → use it directly
 *  2+ templates → Gemini classifies intent from email content
 *                 high/medium confidence → proceed with matched template
 *                 low confidence        → send clarification email, status=pending_clarification
 *  Sender replies to clarification → pick the template they named, proceed
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    await dbConnect()

    const body = await req.json()
    const { from, to, subject, text, html, messageId } = body

    const emailBody = text || html || ''
    const senderEmail = extractEmailAddress(from || '')
    const senderName = extractSenderName(from || '')
    const targetEmail = extractEmailAddress(to || '').toLowerCase().trim()

    // ── STEP 1: resolve which template to use ───────────────────────────────
    const allTemplates = await PricingTemplateModel.find({ targetEmail, active: true })
    if (!allTemplates.length) {
      return NextResponse.json(
        { success: false, error: `No active template found for email: ${targetEmail}` },
        { status: 404 },
      )
    }

    let template: (typeof allTemplates)[0] | null = null

    if (allTemplates.length === 1) {
      // Unambiguous — only one template registered to this inbox
      template = allTemplates[0]
    } else {
      // Multiple templates: check if this is a reply to a pending_clarification item first
      const pendingClarification = await PricingQueueModel.findOne({
        requesterEmail: senderEmail,
        status: 'pending_clarification',
      }).sort({ createdAt: -1 })

      if (pendingClarification && pendingClarification.clarificationOptions?.length) {
        // Try to match sender's reply to one of the offered options
        const searchText = `${subject} ${emailBody}`.toLowerCase()
        const options = pendingClarification.clarificationOptions as { templateId: string; templateName: string }[]
        const picked = options.find((o, i) =>
          searchText.includes(o.templateName.toLowerCase()) ||
          searchText.includes(`option ${i + 1}`) ||
          searchText.includes(`${i + 1}`)
        )

        if (picked) {
          template = allTemplates.find(t => t._id.toString() === picked.templateId) || null
          console.log(`[Email Inbound] Clarification reply matched template: "${picked.templateName}"`)

          // Resolve the pending_clarification item — it will be superseded by the new queue item below
          pendingClarification.status = 'rejected'
          pendingClarification.rejectionReason = 'Resolved — sender clarified intent, new item created'
          pendingClarification.rejectedBy = 'system'
          await pendingClarification.save()
        } else {
          // Can't parse their reply — ask again
          await sendEmail({
            to: senderEmail,
            subject: `Re: ${subject} — Could you clarify?`,
            html: buildClarificationEmail(
              senderName,
              subject,
              options.map(o => ({
                ...o,
                description: allTemplates.find(t => t._id.toString() === o.templateId)?.description || '',
              })),
            ),
          })
          return NextResponse.json({
            success: true,
            message: 'Could not parse clarification reply — asked sender again',
            data: { queueId: pendingClarification._id },
          })
        }
      }

      // No pending clarification, or clarification matched — classify with Gemini
      if (!template) {
        const candidates: TemplateCandidate[] = allTemplates.map(t => ({
          templateId: t._id.toString(),
          templateName: t.name,
          description: t.description,
        }))

        const { matchedTemplateId, confidence, reasoning } = await classifyEmailToTemplate(
          emailBody,
          subject,
          candidates,
        )
        console.log(`[Email Inbound] Template classification: id=${matchedTemplateId} confidence=${confidence} — ${reasoning}`)

        if (matchedTemplateId) {
          template = allTemplates.find(t => t._id.toString() === matchedTemplateId) || null
        }

        if (!template) {
          // Low confidence — ask sender to clarify
          const options = allTemplates.map(t => ({
            templateId: t._id.toString(),
            templateName: t.name,
            description: t.description,
          }))

          const clarificationItem = await PricingQueueModel.create({
            templateId: allTemplates[0]._id.toString(), // placeholder until resolved
            templateName: 'Pending Clarification',
            requesterEmail: senderEmail,
            requesterName: senderName,
            subject,
            originalEmailBody: emailBody,
            emailThread: [{
              from: senderEmail,
              to: targetEmail,
              subject,
              body: emailBody,
              timestamp: new Date().toISOString(),
              messageId,
            }],
            missingFields: [],
            extractedData: {},
            status: 'pending_clarification',
            clarificationOptions: options,
          })

          await sendEmail({
            to: senderEmail,
            subject: `Re: ${subject} — Quick question about your request`,
            html: buildClarificationEmail(senderName, subject, options),
          })

          return NextResponse.json({
            success: true,
            message: 'Multiple templates match this inbox — clarification email sent to requester',
            data: { queueId: clarificationItem._id, status: 'pending_clarification', confidence },
          })
        }
      }
    }

    if (!template) {
      return NextResponse.json({ success: false, error: 'Could not resolve a template' }, { status: 500 })
    }

    // ── STEP 2: standard intent detection (new / reply / correction) ────────
    const pendingInfoItem = await PricingQueueModel.findOne({
      requesterEmail: senderEmail,
      templateId: template._id.toString(),
      status: 'pending_info',
    }).sort({ createdAt: -1 })

    const { intent, confidence: intentConfidence, reasoning: intentReasoning } = await detectEmailIntent(
      emailBody,
      subject,
      !!pendingInfoItem,
    )
    console.log(`[Email Inbound] Intent: ${intent} (${intentConfidence}) — ${intentReasoning} | Template: "${template.name}"`)

    // Build combined text from all sender messages in the thread so field
    // detection sees data spread across the original email + replies.
    // Only include messages FROM the requester — system reply emails contain
    // quoted field lists that would give false-positive matches.
    const buildThreadText = (existingThread: { from: string; body: string }[], newBody: string) => {
      const senderMessages = existingThread
        .filter(m => extractEmailAddress(m.from) === senderEmail)
        .map(m => m.body)
      return [...senderMessages, newBody].join('\n\n---\n\n')
    }

    const { missingFields } = checkMandatoryFields(emailBody, template.mandatoryFields)

    // ── CORRECTION ──────────────────────────────────────────────────────────
    if (intent === 'correction') {
      const cancellableStatuses = ['pending_info', 'pending_summary', 'summarized', 'mapped', 'pending_approval']
      const cancelled = await PricingQueueModel.updateMany(
        { requesterEmail: senderEmail, templateId: template._id.toString(), status: { $in: cancellableStatuses } },
        { $set: { status: 'rejected', rejectionReason: 'Superseded by correction email from requester', rejectedBy: 'system' } },
      )
      console.log(`[Email Inbound] Cancelled ${cancelled.modifiedCount} previous item(s) as correction`)
    }

    // ── REPLY providing missing info ─────────────────────────────────────────
    if (intent === 'reply_missing_info' && pendingInfoItem) {
      pendingInfoItem.emailThread.push({
        from: senderEmail,
        to: targetEmail,
        subject,
        body: emailBody,
        timestamp: new Date().toISOString(),
        messageId,
      })

      // Check fields against the full thread — not just the latest reply
      const threadText = buildThreadText(pendingInfoItem.emailThread.slice(0, -1), emailBody)
      const { missingFields: threadMissingFields } = checkMandatoryFields(threadText, template.mandatoryFields)

      if (threadMissingFields.length > 0) {
        pendingInfoItem.missingFields = threadMissingFields
        await pendingInfoItem.save()
        await sendEmail({
          to: senderEmail,
          subject: `Re: ${subject} — Still Missing Information`,
          html: buildMissingFieldsEmail(senderName, threadMissingFields, template.name, subject),
        })
        return NextResponse.json({
          success: true,
          message: 'Reply processed — still missing fields, follow-up sent',
          data: { queueId: pendingInfoItem._id, missingFields: threadMissingFields, intent },
        })
      }

      pendingInfoItem.status = 'pending_summary'
      pendingInfoItem.missingFields = []
      await pendingInfoItem.save()

      // Summarize using the full thread so Gemini has all field values in context
      const { summary, extractedData } = await summarizeEmailWithGemini(threadText, template.name, template.mandatoryFields)
      const mappedData = await mapToPricingTemplate(extractedData, summary, [
        ...template.mandatoryFields,
        ...(template.optionalFields || []),
      ])
      pendingInfoItem.summary = summary
      pendingInfoItem.extractedData = extractedData
      pendingInfoItem.mappedData = mappedData
      pendingInfoItem.status = 'pending_approval'
      await pendingInfoItem.save()

      return NextResponse.json({
        success: true,
        message: 'Reply processed — all fields present, added to approval queue',
        data: { queueId: pendingInfoItem._id, status: 'pending_approval', intent },
      })
    }

    // ── NEW REQUEST (or correction fall-through) ─────────────────────────────
    const newQueueItem = await PricingQueueModel.create({
      templateId: template._id.toString(),
      templateName: template.name,
      requesterEmail: senderEmail,
      requesterName: senderName,
      subject,
      originalEmailBody: emailBody,
      emailThread: [{
        from: senderEmail,
        to: targetEmail,
        subject,
        body: emailBody,
        timestamp: new Date().toISOString(),
        messageId,
      }],
      missingFields,
      extractedData: {},
      status: missingFields.length > 0 ? 'pending_info' : 'pending_summary',
    })

    if (missingFields.length > 0) {
      await sendEmail({
        to: senderEmail,
        subject: `Re: ${subject} — Missing Required Information`,
        html: buildMissingFieldsEmail(senderName, missingFields, template.name, subject),
      })
      return NextResponse.json({
        success: true,
        message: 'Email received — missing fields, follow-up sent to requester',
        data: { queueId: newQueueItem._id, missingFields, intent },
      })
    }

    const { summary, extractedData } = await summarizeEmailWithGemini(emailBody, template.name, template.mandatoryFields)
    const mappedData = await mapToPricingTemplate(extractedData, summary, [
      ...template.mandatoryFields,
      ...(template.optionalFields || []),
    ])
    newQueueItem.summary = summary
    newQueueItem.extractedData = extractedData
    newQueueItem.mappedData = mappedData
    newQueueItem.status = 'pending_approval'
    await newQueueItem.save()

    return NextResponse.json({
      success: true,
      message: intent === 'correction'
        ? 'Correction received — previous requests cancelled, new request queued for approval'
        : 'Email processed and added to approval queue',
      data: { queueId: newQueueItem._id, status: 'pending_approval', intent },
    })
  } catch (err) {
    console.error('[Email Inbound]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
