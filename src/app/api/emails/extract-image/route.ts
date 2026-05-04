import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromImage } from '@/lib/gemini'
import { sendEmail } from '@/lib/email'

const SUPPORTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
]
const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * POST /api/emails/extract-image
 * Accepts multipart form data:
 *   - image: File
 *   - senderEmail: string (required)
 *   - senderName: string (optional)
 *   - subject: string (optional, defaults to "Pricing Update Request")
 *
 * 1. Validates the image
 * 2. Calls Gemini Vision to extract pricing text
 * 3. Sends audit email to PRICING_EMAIL with image attached
 * 4. Returns { extractedText, filename }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const senderEmail = ((formData.get('senderEmail') as string) || '').trim()
    const senderName = ((formData.get('senderName') as string) || '').trim()
    const subject = ((formData.get('subject') as string) || 'Pricing Update Request').trim()

    if (!imageFile) {
      return NextResponse.json({ success: false, error: 'No image file provided' }, { status: 400 })
    }
    if (!senderEmail) {
      return NextResponse.json({ success: false, error: 'Sender email is required' }, { status: 400 })
    }
    if (!SUPPORTED_TYPES.includes(imageFile.type)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${imageFile.type || 'unknown'}. Please upload a JPG, PNG, GIF, WebP, BMP, or TIFF image.` },
        { status: 400 },
      )
    }
    if (imageFile.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image exceeds the 8 MB limit. Please compress or resize the image and try again.' },
        { status: 400 },
      )
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')

    // Extract pricing text via Gemini Vision
    const extractedText = await extractTextFromImage(base64Data, imageFile.type)

    // Send audit email to PRICING_EMAIL with the image attached (non-fatal)
    const pricingEmail = process.env.PRICING_EMAIL
    if (pricingEmail) {
      const auditSubject = subject.toLowerCase().startsWith('pricing update request')
        ? subject
        : `Pricing Update Request — ${subject}`

      const displaySender = senderName ? `${senderName} &lt;${senderEmail}&gt;` : senderEmail

      try {
        await sendEmail({
          to: pricingEmail,
          subject: auditSubject,
          replyTo: senderEmail,
          html: `
            <div style="font-family:-apple-system,sans-serif;color:#1e293b;max-width:600px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:28px 32px;border-radius:12px 12px 0 0">
                <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600">Image Upload — Pricing Update</h1>
                <p style="color:#94a3b8;margin:6px 0 0;font-size:13px">Submitted via the Pricing Workflow upload tool</p>
              </div>
              <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none">
                <p style="margin:0 0 8px"><strong>From:</strong> ${displaySender}</p>
                <p style="margin:0 0 8px"><strong>Subject:</strong> ${subject}</p>
                <p style="margin:0 0 20px"><strong>File:</strong> ${imageFile.name} (${(imageFile.size / 1024).toFixed(1)} KB)</p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px">
                <p style="margin:0 0 10px;font-weight:600;color:#0f172a">Extracted Text:</p>
                <pre style="font-family:monospace;background:#f8fafc;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:13px;color:#334155;border:1px solid #e2e8f0">${extractedText}</pre>
              </div>
            </div>
          `,
          attachments: [
            {
              filename: imageFile.name || `pricing-image.${imageFile.type.split('/')[1] || 'jpg'}`,
              content: buffer,
              contentType: imageFile.type,
            },
          ],
        })
      } catch (emailErr) {
        console.warn('[Extract Image] Audit email failed (non-fatal):', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        extractedText,
        filename: imageFile.name,
        fileSize: imageFile.size,
        mimeType: imageFile.type,
      },
    })
  } catch (err) {
    console.error('[Extract Image]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
