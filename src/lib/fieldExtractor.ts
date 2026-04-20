import { TemplateField } from '@/types'

/**
 * Checks if an email body contains all mandatory fields from a template.
 * Uses keyword matching as a first pass before AI extraction.
 */
export function checkMandatoryFields(
  emailBody: string,
  mandatoryFields: TemplateField[]
): { missingFields: string[]; foundFields: string[] } {
  const body = emailBody.toLowerCase()
  const missingFields: string[] = []
  const foundFields: string[] = []

  for (const field of mandatoryFields) {
    if (!field.required) continue

    const keyVariants = [
      field.key.toLowerCase(),
      field.label.toLowerCase(),
      field.key.replace(/_/g, ' ').toLowerCase(),
      field.key.replace(/-/g, ' ').toLowerCase(),
    ]

    const found = keyVariants.some(variant => body.includes(variant))

    if (found) {
      foundFields.push(field.label)
    } else {
      missingFields.push(field.label)
    }
  }

  return { missingFields, foundFields }
}

/**
 * Extracts the sender name from an email address or display name string.
 */
export function extractSenderName(fromField: string): string {
  const match = fromField.match(/^"?([^"<]+)"?\s*<?/)
  if (match && match[1].trim()) {
    return match[1].trim()
  }
  const emailMatch = fromField.match(/([^@<\s]+)@/)
  if (emailMatch) {
    return emailMatch[1].replace(/[._-]/g, ' ')
  }
  return 'User'
}

/**
 * Extracts the email address from a "From" header string.
 */
export function extractEmailAddress(fromField: string): string {
  const match = fromField.match(/<([^>]+)>/)
  if (match) return match[1]
  const emailMatch = fromField.match(/[\w.+-]+@[\w.-]+\.\w+/)
  if (emailMatch) return emailMatch[0]
  return fromField
}
