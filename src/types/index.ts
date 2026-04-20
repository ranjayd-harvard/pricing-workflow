export interface TemplateField {
  key: string
  label: string
  type: 'string' | 'number' | 'date' | 'select' | 'currency'
  required: boolean
  options?: string[]
  description?: string
  example?: string
}

export type TargetCollection = 'products' | 'events' | 'generic'

export interface PricingTemplate {
  _id?: string
  name: string
  description: string
  mandatoryFields: TemplateField[]
  optionalFields?: TemplateField[]
  targetEmail: string
  targetCollection: TargetCollection
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export type QueueStatus =
  | 'pending_clarification' // Multiple templates match — waiting for sender to clarify intent
  | 'pending_info'
  | 'pending_summary'
  | 'summarized'
  | 'mapped'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'price_updated'
  | 'failed'

export interface EmailThread {
  from: string
  to: string
  subject: string
  body: string
  timestamp: string
  messageId?: string
}

export interface MappedPricingData {
  [key: string]: string | number | boolean | null
}

export interface PricingQueueItem {
  _id?: string
  templateId: string
  templateName: string
  status: QueueStatus
  requesterEmail: string
  requesterName?: string
  subject: string
  originalEmailBody: string
  emailThread: EmailThread[]
  missingFields: string[]
  extractedData: MappedPricingData
  summary?: string
  mappedData?: MappedPricingData
  clarificationOptions?: { templateId: string; templateName: string }[]
  approvedBy?: string
  approvedAt?: string
  rejectedBy?: string
  rejectedAt?: string
  rejectionReason?: string
  apiCallResult?: {
    success: boolean
    response?: unknown
    error?: string
    calledAt?: string
  }
  createdAt?: string
  updatedAt?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
