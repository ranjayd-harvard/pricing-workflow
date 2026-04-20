import mongoose, { Schema, Document } from 'mongoose'

export interface EventDocument extends Document {
  event_id: string           // unique identifier (e.g. internal_event_id)
  event_name: string
  current_price: number
  new_price: number
  effective_date?: string
  reason?: string
  sponsor?: string
  notes?: string
  last_updated_by: string    // requester email
  last_queue_id: string      // reference back to the queue item
  price_history: {
    old_price: number
    new_price: number
    changed_at: string
    queue_id: string
  }[]
  createdAt?: string
  updatedAt?: string
}

const EventSchema = new Schema<EventDocument>(
  {
    event_id:       { type: String, required: true, unique: true, trim: true },
    event_name:     { type: String, required: true, trim: true },
    current_price:  { type: Number, required: true },
    new_price:      { type: Number, required: true },
    effective_date: { type: String },
    reason:         { type: String },
    sponsor:        { type: String },
    notes:          { type: String },
    last_updated_by: { type: String, required: true },
    last_queue_id:  { type: String, required: true },
    price_history: {
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
  { timestamps: true },
)

export const EventModel =
  mongoose.models.Event ||
  mongoose.model<EventDocument>('Event', EventSchema)
