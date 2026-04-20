import mongoose, { Schema, Document } from 'mongoose'
import { PricingTemplate, TargetCollection, TemplateField } from '@/types'

export interface PricingTemplateDocument extends Omit<PricingTemplate, '_id'>, Document {}

const TemplateFieldSchema = new Schema<TemplateField>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['string', 'number', 'currency', 'date', 'select'], required: true },
    required: { type: Boolean, default: true },
    options: [String],
    description: String,
    example: String,
  },
  { _id: false }
)

const PricingTemplateSchema = new Schema<PricingTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    mandatoryFields: { type: [TemplateFieldSchema], required: true },
    optionalFields: { type: [TemplateFieldSchema], default: [] },
    targetEmail: { type: String, required: true, lowercase: true, trim: true },
    targetCollection: {
      type: String,
      enum: ['products', 'events', 'generic'] as TargetCollection[],
      default: 'products',
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

export const PricingTemplateModel =
  mongoose.models.PricingTemplate ||
  mongoose.model<PricingTemplateDocument>('PricingTemplate', PricingTemplateSchema)
