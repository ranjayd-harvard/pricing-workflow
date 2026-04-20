import mongoose, { Schema, Document } from 'mongoose'

export interface ProductDocument extends Document {
  product_sku: string
  product_name: string
  current_price: number
  new_price: number
  effective_date: string
  reason: string
  region?: string
  currency?: string
  notes?: string
  last_updated_by: string   // requester email
  last_queue_id: string     // reference back to the queue item
  price_history: {
    old_price: number
    new_price: number
    changed_at: string
    queue_id: string
  }[]
  createdAt?: string
  updatedAt?: string
}

const ProductSchema = new Schema<ProductDocument>(
  {
    product_sku:    { type: String, required: true, unique: true, trim: true, uppercase: true },
    product_name:   { type: String, required: true, trim: true },
    current_price:  { type: Number, required: true },
    new_price:      { type: Number, required: true },
    effective_date: { type: String, required: true },
    reason:         { type: String, required: true },
    region:         { type: String },
    currency:       { type: String, default: 'USD' },
    notes:          { type: String },
    last_updated_by: { type: String, required: true },
    last_queue_id:  { type: String, required: true },
    price_history:  {
      type: [
        {
          old_price:  { type: Number, required: true },
          new_price:  { type: Number, required: true },
          changed_at: { type: String, required: true },
          queue_id:   { type: String, required: true },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
)

export const ProductModel =
  mongoose.models.Product ||
  mongoose.model<ProductDocument>('Product', ProductSchema)
