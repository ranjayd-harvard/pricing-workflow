import dbConnect from '@/lib/db'
import { ProductModel } from '@/models/Product'
import { EventModel } from '@/models/Event'
import { MappedPricingData, TargetCollection } from '@/types'

export interface PricingApiResult {
  success: boolean
  response?: unknown
  error?: string
  calledAt: string
}

/**
 * Dispatches approved pricing data to the correct collection based on
 * the template's targetCollection setting.
 *
 * 'products' → upsert ProductModel by product_sku (existing behaviour)
 * 'events'   → placeholder until EventModel is built; logs and returns success
 * 'generic'  → no write; data stays in the queue item only
 */
export async function callPricingApi(
  mappedData: MappedPricingData,
  queueId?: string,
  requesterEmail?: string,
  targetCollection: TargetCollection = 'products',
): Promise<PricingApiResult> {
  const calledAt = new Date().toISOString()

  try {
    await dbConnect()

    if (targetCollection === 'generic') {
      console.log(`[PricingAPI] targetCollection=generic — data stored in queue item only`)
      return { success: true, response: { action: 'stored_in_queue', queueId }, calledAt }
    }

    if (targetCollection === 'events') {
      const eventId = String(mappedData.event_id || '').trim()
      if (!eventId) {
        return { success: false, error: 'event_id is required to update the events table', calledAt }
      }

      const existing = await EventModel.findOne({ event_id: eventId })
      const oldPrice = existing ? existing.current_price : null

      const historyEntry = oldPrice !== null
        ? [{ old_price: oldPrice, new_price: Number(mappedData.new_price), changed_at: calledAt, queue_id: queueId || '' }]
        : []

      const updated = await EventModel.findOneAndUpdate(
        { event_id: eventId },
        {
          $set: {
            event_id:        eventId,
            event_name:      String(mappedData.event_name || ''),
            current_price:   Number(mappedData.new_price),
            new_price:       Number(mappedData.new_price),
            effective_date:  mappedData.effective_date ? String(mappedData.effective_date) : undefined,
            reason:          mappedData.reason         ? String(mappedData.reason)         : undefined,
            sponsor:         mappedData.event_sponsor  ? String(mappedData.event_sponsor)  : undefined,
            notes:           mappedData.notes          ? String(mappedData.notes)          : undefined,
            last_updated_by: requesterEmail || '',
            last_queue_id:   queueId || '',
          },
          $push: historyEntry.length ? { price_history: { $each: historyEntry } } : {},
        },
        { upsert: true, new: true },
      )

      console.log(`[PricingAPI] Event ${eventId} ${existing ? 'updated' : 'created'} — new price: ${mappedData.new_price}`)

      return {
        success: true,
        response: {
          event_id:       updated.event_id,
          event_name:     updated.event_name,
          previous_price: oldPrice,
          current_price:  updated.current_price,
          effective_date: updated.effective_date,
          action:         existing ? 'updated' : 'created',
        },
        calledAt,
      }
    }

    // ── products (default) ────────────────────────────────────────────────
    const sku = String(mappedData.product_sku || '').trim().toUpperCase()
    if (!sku) {
      return { success: false, error: 'product_sku is required to update the products table', calledAt }
    }

    const existing = await ProductModel.findOne({ product_sku: sku })
    const oldPrice = existing ? existing.current_price : null

    const historyEntry = oldPrice !== null
      ? [{ old_price: oldPrice, new_price: Number(mappedData.new_price), changed_at: calledAt, queue_id: queueId || '' }]
      : []

    const updated = await ProductModel.findOneAndUpdate(
      { product_sku: sku },
      {
        $set: {
          product_sku:     sku,
          product_name:    String(mappedData.product_name || ''),
          current_price:   Number(mappedData.new_price),
          new_price:       Number(mappedData.new_price),
          effective_date:  String(mappedData.effective_date || ''),
          reason:          String(mappedData.reason || ''),
          region:          mappedData.region   ? String(mappedData.region)   : undefined,
          currency:        mappedData.currency ? String(mappedData.currency) : 'USD',
          notes:           mappedData.notes    ? String(mappedData.notes)    : undefined,
          last_updated_by: requesterEmail || '',
          last_queue_id:   queueId || '',
        },
        $push: historyEntry.length ? { price_history: { $each: historyEntry } } : {},
      },
      { upsert: true, new: true },
    )

    console.log(`[PricingAPI] Product ${sku} ${existing ? 'updated' : 'created'} — new price: ${mappedData.new_price}`)

    return {
      success: true,
      response: {
        product_sku:    updated.product_sku,
        product_name:   updated.product_name,
        previous_price: oldPrice,
        current_price:  updated.current_price,
        effective_date: updated.effective_date,
        action:         existing ? 'updated' : 'created',
      },
      calledAt,
    }
  } catch (err) {
    console.error('[PricingAPI] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      calledAt,
    }
  }
}
