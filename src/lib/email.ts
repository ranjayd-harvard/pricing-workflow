import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

export async function sendEmail(options: SendEmailOptions) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
    attachments: options.attachments,
  })
  return info
}

export function buildMissingFieldsEmail(
  requesterName: string,
  missingFields: string[],
  templateName: string,
  originalSubject: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 600; }
    .header p { color: #94a3b8; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .body p { line-height: 1.7; color: #475569; margin: 0 0 16px; }
    .fields-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .fields-box h3 { color: #92400e; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
    .field-item { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #fde68a; }
    .field-item:last-child { border-bottom: none; }
    .field-bullet { width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; margin-right: 12px; flex-shrink: 0; }
    .field-name { color: #78350f; font-weight: 500; font-size: 14px; }
    .cta-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .cta-box p { color: #0369a1; margin: 0; font-size: 14px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Pricing Request — Missing Information</h1>
      <p>Action required to process your request</p>
    </div>
    <div class="body">
      <p>Hi ${requesterName || 'there'},</p>
      <p>Thank you for submitting your pricing update request (<strong>${originalSubject}</strong>) via the <strong>${templateName}</strong> template.</p>
      <p>Unfortunately, we were unable to process your request because the following mandatory fields are missing from your submission:</p>
      
      <div class="fields-box">
        <h3>🚫 Missing Required Fields</h3>
        ${missingFields.map(f => `
          <div class="field-item">
            <div class="field-bullet"></div>
            <div class="field-name">${f}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="cta-box">
        <p>💡 <strong>Next steps:</strong> Please reply to this email with all the missing information clearly labeled. For example: <em>"Product SKU: ABC-123"</em>, <em>"New Price: $49.99"</em>, etc.</p>
      </div>
      
      <p>Once we receive the complete information, we'll process your pricing update request right away.</p>
      <p>If you have any questions, please don't hesitate to reach out.</p>
      <p>Best regards,<br><strong>Pricing Workflow System</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated message from the Pricing Workflow System. Please do not reply directly to this email unless providing missing field information.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export function buildClarificationEmail(
  requesterName: string,
  originalSubject: string,
  options: { templateId: string; templateName: string; description: string }[],
): string {
  const optionRows = options
    .map(
      (o, i) => `
      <div class="option-item">
        <span class="option-num">${i + 1}</span>
        <div>
          <div class="option-name">${o.templateName}</div>
          <div class="option-desc">${o.description}</div>
        </div>
      </div>`,
    )
    .join('')

  const replyInstructions = options
    .map((o, i) => `Reply with <strong>"Option ${i + 1}"</strong> or <strong>"${o.templateName}"</strong> to select this type.`)
    .join('<br>')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 600; }
    .header p { color: #94a3b8; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .body p { line-height: 1.7; color: #475569; margin: 0 0 16px; }
    .options-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .options-box h3 { color: #0369a1; margin: 0 0 16px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
    .option-item { display: flex; align-items: flex-start; gap: 14px; padding: 12px 0; border-bottom: 1px solid #e0f2fe; }
    .option-item:last-child { border-bottom: none; padding-bottom: 0; }
    .option-num { width: 28px; height: 28px; background: #0ea5e9; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
    .option-name { font-weight: 600; color: #0c4a6e; font-size: 14px; }
    .option-desc { color: #475569; font-size: 13px; margin-top: 2px; }
    .cta-box { background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .cta-box p { color: #78350f; margin: 0; font-size: 14px; line-height: 1.7; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤔 Clarification Needed</h1>
      <p>Help us route your pricing request correctly</p>
    </div>
    <div class="body">
      <p>Hi ${requesterName || 'there'},</p>
      <p>Thank you for your pricing update request (<strong>${originalSubject}</strong>). We received your email but weren't sure which type of update you're requesting — we have multiple templates that could apply.</p>

      <div class="options-box">
        <h3>Which type of update is this?</h3>
        ${optionRows}
      </div>

      <div class="cta-box">
        <p>💬 <strong>Just reply to this email</strong> with the option number or name that best matches your request:<br><br>${replyInstructions}</p>
      </div>

      <p>Once you reply, we'll apply the right template and process your request right away — no need to resend the original details.</p>
      <p>Best regards,<br><strong>Pricing Workflow System</strong></p>
    </div>
    <div class="footer">
      <p>Automated message from the Pricing Workflow System</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export function buildConfirmationEmail(
  requesterName: string,
  subject: string,
  summary: string,
  fields: Record<string, string | number | null>,
): string {
  const fieldRows = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;white-space:nowrap">${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;font-family:monospace">${v}</td>
      </tr>`).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%); padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 600; }
    .header p { color: #bae6fd; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .body p { line-height: 1.7; color: #475569; margin: 0 0 16px; }
    .summary-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px 20px; margin: 16px 0; font-size: 14px; color: #0c4a6e; line-height: 1.7; }
    .fields-table { width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .fields-table th { background: #f8fafc; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    .cta-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .cta-box p { color: #14532d; margin: 0 0 8px; font-size: 14px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Please Confirm Your Request</h1>
      <p>Review the details we extracted before we proceed</p>
    </div>
    <div class="body">
      <p>Hi ${requesterName || 'there'},</p>
      <p>We received your pricing update request for <strong>${subject}</strong> and extracted the following details. Please review and confirm they are correct before we proceed to the approval queue.</p>

      <div class="summary-box">${summary}</div>

      <table class="fields-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Extracted Value</th>
          </tr>
        </thead>
        <tbody>${fieldRows}</tbody>
      </table>

      <div class="cta-box">
        <p><strong>Does everything look correct?</strong></p>
        <p style="color:#166534;font-size:13px">Reply <strong>"Yes, confirmed"</strong> to proceed to approval.<br>Reply <strong>"No"</strong> or send a correction if anything is wrong.</p>
      </div>

      <p>Best regards,<br><strong>Pricing Workflow System</strong></p>
    </div>
    <div class="footer">
      <p>Automated message from the Pricing Workflow System</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export function buildApiFailureEmail(
  requesterEmail: string,
  subject: string,
  errorMessage: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f59e0b; padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 600; }
    .header p { color: #fef3c7; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .body p { line-height: 1.7; color: #475569; margin: 0 0 16px; }
    .error-box { background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 16px 20px; margin: 16px 0; font-size: 14px; color: #713f12; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Action Required</h1>
      <p>Your request was approved but could not be processed</p>
    </div>
    <div class="body">
      <p>Your pricing update request for <strong>${subject}</strong> was approved, but we were unable to apply it due to missing or invalid information:</p>
      <div class="error-box">${errorMessage}</div>
      <p>Please <strong>reply to this email</strong> with the missing information and we will reprocess your request immediately.</p>
      <p>Best regards,<br><strong>Pricing Workflow System</strong></p>
    </div>
    <div class="footer">
      <p>Automated notification from Pricing Workflow System</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export function buildApprovalNotificationEmail(
  requesterEmail: string,
  subject: string,
  approved: boolean,
  reason?: string
): string {
  const statusColor = approved ? '#10b981' : '#ef4444'
  const statusText = approved ? 'Approved ✅' : 'Rejected ❌'
  const statusMsg = approved
    ? 'Your pricing update has been approved and the system is updating the price now.'
    : `Your pricing update request was not approved. ${reason ? `Reason: ${reason}` : ''}`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: ${statusColor}; padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 600; }
    .body { padding: 32px; }
    .body p { line-height: 1.7; color: #475569; margin: 0 0 16px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pricing Request ${statusText}</h1>
    </div>
    <div class="body">
      <p>Your pricing update request for <strong>${subject}</strong> has been reviewed.</p>
      <p>${statusMsg}</p>
      <p>Best regards,<br><strong>Pricing Workflow System</strong></p>
    </div>
    <div class="footer">
      <p>Automated notification from Pricing Workflow System</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
