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

export interface PricingApiMultiResult {
  success: boolean          // true only if ALL items succeeded
  results: PricingApiResult[]
  successCount: number
  failureCount: number
  calledAt: string
}

/**
 * Calls callPricingApi for each item in the array and aggregates results.
 * Partial success (some rows failed) is reflected in success=false.
 */
export async function callPricingApiForItems(
  items: MappedPricingData[],
  queueId?: string,
  requesterEmail?: string,
  targetCollection: TargetCollection = 'products',
): Promise<PricingApiMultiResult> {
  const calledAt = new Date().toISOString()
  const results: PricingApiResult[] = []

  for (const item of items) {
    const result = await callPricingApi(item, queueId, requesterEmail, targetCollection)
    results.push(result)
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount

  return {
    success: failureCount === 0,
    results,
    successCount,
    failureCount,
    calledAt,
  }
}

/**
 * Dispatches approved pricing data to the correct collection based on
 * the template's targetCollection setting.
 *
 * 'products' → upsert ProductModel by product_sku (existing behaviour)
 * 'events'   → placeholder until EventModel is built; logs and returns success
 * 'generic'  → no write; data stays in the queue item only
 */
/** Case-insensitive field lookup on mappedData */
function getField(data: MappedPricingData, key: string): unknown {
  const match = Object.keys(data).find(k => k.toLowerCase() === key.toLowerCase())
  return match !== undefined ? data[match] : undefined
}

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
      const rawId = String(getField(mappedData, 'event_id') || '').trim()
      const eventId = rawId || String(getField(mappedData, 'event_name') || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')
      if (!eventId) {
        return { success: false, error: 'event_id (or event_name to derive one) is required to update the events table', calledAt }
      }

      const existing = await EventModel.findOne({ event_id: eventId })
      const oldPrice = existing ? existing.current_price : null
      const newPrice = parseFloat(String(getField(mappedData, 'new_price') ?? '').replace(/[^0-9.-]/g, ''))

      const historyEntry = oldPrice !== null
        ? [{ old_price: oldPrice, new_price: newPrice, changed_at: calledAt, queue_id: queueId || '' }]
        : []

      const updated = await EventModel.findOneAndUpdate(
        { event_id: eventId },
        {
          $set: {
            event_id:        eventId,
            event_name:      String(getField(mappedData, 'event_name') || ''),
            current_price:   newPrice,
            new_price:       newPrice,
            effective_date:  getField(mappedData, 'effective_date') ? String(getField(mappedData, 'effective_date')) : undefined,
            reason:          getField(mappedData, 'reason')         ? String(getField(mappedData, 'reason'))         : undefined,
            sponsor:         getField(mappedData, 'event_sponsor')  ? String(getField(mappedData, 'event_sponsor'))  : undefined,
            notes:           getField(mappedData, 'notes')          ? String(getField(mappedData, 'notes'))          : undefined,
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
    const sku = String(getField(mappedData, 'product_sku') || '').trim().toUpperCase()
    if (!sku) {
      return { success: false, error: 'product_sku is required to update the products table', calledAt }
    }

    const existing = await ProductModel.findOne({ product_sku: sku })
    const oldPrice = existing ? existing.current_price : null
    const newPrice = parseFloat(String(getField(mappedData, 'new_price') ?? '').replace(/[^0-9.-]/g, ''))

    const historyEntry = oldPrice !== null
      ? [{ old_price: oldPrice, new_price: newPrice, changed_at: calledAt, queue_id: queueId || '' }]
      : []

    const updated = await ProductModel.findOneAndUpdate(
      { product_sku: sku },
      {
        $set: {
          product_sku:     sku,
          product_name:    String(getField(mappedData, 'product_name') || ''),
          current_price:   newPrice,
          new_price:       newPrice,
          effective_date:  String(getField(mappedData, 'effective_date') || ''),
          reason:          String(getField(mappedData, 'reason') || ''),
          region:          getField(mappedData, 'region')   ? String(getField(mappedData, 'region'))   : undefined,
          currency:        getField(mappedData, 'currency') ? String(getField(mappedData, 'currency')) : 'USD',
          notes:           getField(mappedData, 'notes')    ? String(getField(mappedData, 'notes'))    : undefined,
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
