import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { extractTextFromSpreadsheet } from '@/lib/gemini'
import { sendEmail } from '@/lib/email'

const SUPPORTED_TYPES: Record<string, string> = {
  'text/csv': 'csv',
  'application/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/octet-stream': 'auto', // some clients send this for .csv/.xlsx
}

const SUPPORTED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls'])
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function getExtension(filename: string): string {
  const m = filename.toLowerCase().match(/\.[^.]+$/)
  return m ? m[0] : ''
}

/**
 * Convert all sheets in a workbook to a single plain-text block.
 * Each sheet is rendered as CSV rows separated by newlines, with a header
 * showing the sheet name when there are multiple sheets.
 */
function workbookToText(wb: XLSX.WorkBook): string {
  const blocks: string[] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ',', blankrows: false })
    const trimmed = csv.trim()
    if (!trimmed) continue
    if (wb.SheetNames.length > 1) {
      blocks.push(`Sheet: ${sheetName}\n${trimmed}`)
    } else {
      blocks.push(trimmed)
    }
  }
  return blocks.join('\n\n')
}

/**
 * POST /api/emails/extract-spreadsheet
 * Accepts multipart form data:
 *   - file: File (.csv, .xlsx, .xls)
 *   - senderEmail: string (required)
 *   - senderName: string (optional)
 *   - subject: string (optional)
 *
 * 1. Parses the spreadsheet with SheetJS
 * 2. Calls Gemini to extract pricing text from the table data
 * 3. Sends audit email to PRICING_EMAIL with file attached
 * 4. Returns { extractedText, filename, sheetNames }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const senderEmail = ((formData.get('senderEmail') as string) || '').trim()
    const senderName = ((formData.get('senderName') as string) || '').trim()
    const subject = ((formData.get('subject') as string) || 'Pricing Update Request').trim()

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }
    if (!senderEmail) {
      return NextResponse.json({ success: false, error: 'Sender email is required' }, { status: 400 })
    }

    const ext = getExtension(file.name)
    const mimeOk = file.type in SUPPORTED_TYPES
    const extOk = SUPPORTED_EXTENSIONS.has(ext)

    if (!mimeOk && !extOk) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type. Please upload a CSV, XLSX, or XLS file.` },
        { status: 400 },
      )
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File exceeds the 10 MB limit.' },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse spreadsheet — SheetJS handles CSV, XLS, and XLSX from a buffer
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const tableText = workbookToText(wb)

    if (!tableText.trim()) {
      return NextResponse.json({ success: false, error: 'The file appears to be empty.' }, { status: 400 })
    }

    // Extract pricing text via Gemini
    const extractedText = await extractTextFromSpreadsheet(tableText)

    // Send audit email to PRICING_EMAIL with the file attached (non-fatal)
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
                <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600">Spreadsheet Upload — Pricing Update</h1>
                <p style="color:#94a3b8;margin:6px 0 0;font-size:13px">Submitted via the Pricing Workflow upload tool</p>
              </div>
              <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none">
                <p style="margin:0 0 8px"><strong>From:</strong> ${displaySender}</p>
                <p style="margin:0 0 8px"><strong>Subject:</strong> ${subject}</p>
                <p style="margin:0 0 8px"><strong>File:</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
                <p style="margin:0 0 20px"><strong>Sheets:</strong> ${wb.SheetNames.join(', ')}</p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px">
                <p style="margin:0 0 10px;font-weight:600;color:#0f172a">Extracted Text:</p>
                <pre style="font-family:monospace;background:#f8fafc;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:13px;color:#334155;border:1px solid #e2e8f0">${extractedText}</pre>
              </div>
            </div>
          `,
          attachments: [{ filename: file.name, content: buffer, contentType: file.type || 'application/octet-stream' }],
        })
      } catch (emailErr) {
        console.warn('[Extract Spreadsheet] Audit email failed (non-fatal):', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        extractedText,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        sheetNames: wb.SheetNames,
      },
    })
  } catch (err) {
    console.error('[Extract Spreadsheet]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
