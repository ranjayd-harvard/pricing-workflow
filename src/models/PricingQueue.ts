import mongoose, { Schema, Document } from 'mongoose'
import { PricingQueueItem, EmailThread, MappedPricingData, QueueStatus } from '@/types'

export interface PricingQueueDocument extends Omit<PricingQueueItem, '_id'>, Document {}

const EmailThreadSchema = new Schema<EmailThread>(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    timestamp: { type: String, required: true },
    messageId: String,
  },
  { _id: false }
)

const PricingQueueSchema = new Schema<PricingQueueDocument>(
  {
    templateId: { type: String, required: true },
    templateName: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'pending_clarification',
        'pending_info',
        'pending_summary',
        'summarized',
        'mapped',
        'pending_approval',
        'approved',
        'rejected',
        'price_updated',
        'failed',
      ] as QueueStatus[],
      default: 'pending_info',
    },
    requesterEmail: { type: String, required: true, lowercase: true },
    requesterName: String,
    subject: { type: String, required: true },
    originalEmailBody: { type: String, required: true },
    emailThread: { type: [EmailThreadSchema], default: [] },
    missingFields: { type: [String], default: [] },
    extractedData: { type: Schema.Types.Mixed, default: {} },
    summary: String,
    mappedData: { type: Schema.Types.Mixed },
    approvedBy: String,
    approvedAt: String,
    rejectedBy: String,
    rejectedAt: String,
    rejectionReason: String,
    // Set when status=pending_clarification — stores the template IDs/names offered to the sender
    clarificationOptions: {
      type: [{ templateId: String, templateName: String }],
      default: undefined,
    },
    apiCallResult: {
      success: Boolean,
      response: Schema.Types.Mixed,
      error: String,
      calledAt: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Index for fast lookup
PricingQueueSchema.index({ status: 1, createdAt: -1 })
PricingQueueSchema.index({ requesterEmail: 1 })
PricingQueueSchema.index({ templateId: 1 })

export const PricingQueueModel =
  mongoose.models.PricingQueue ||
  mongoose.model<PricingQueueDocument>('PricingQueue', PricingQueueSchema)
