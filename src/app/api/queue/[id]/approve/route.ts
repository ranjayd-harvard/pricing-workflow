import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { PricingQueueModel } from '@/models/PricingQueue'
import { sendEmail, buildApprovalNotificationEmail } from '@/lib/email'
import { callPricingApi } from '@/lib/pricingApi'
import { PricingTemplateModel } from '@/models/PricingTemplate'
import { ApiResponse } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    await dbConnect()
    const { id } = await params
    const { approvedBy = 'admin' } = await req.json().catch(() => ({}))

    const item = await PricingQueueModel.findById(id)
    if (!item) return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 })

    if (item.status !== 'pending_approval') {
      return NextResponse.json({ success: false, error: `Cannot approve item with status: ${item.status}` }, { status: 400 })
    }

    item.status = 'approved'
    item.approvedBy = approvedBy
    item.approvedAt = new Date().toISOString()
    await item.save()

    // Look up which collection this template writes to
    const template = await PricingTemplateModel.findById(item.templateId).lean<{ targetCollection?: string }>()
    const targetCollection = (template?.targetCollection ?? 'products') as import('@/types').TargetCollection

    const apiResult = await callPricingApi(item.mappedData || item.extractedData || {}, id, item.requesterEmail, targetCollection)
    item.apiCallResult = apiResult
    item.status = apiResult.success ? 'price_updated' : 'failed'
    await item.save()

    // Notify requester
    try {
      await sendEmail({
        to: item.requesterEmail,
        subject: `Re: ${item.subject} — Pricing Update ${apiResult.success ? 'Complete' : 'Failed'}`,
        html: buildApprovalNotificationEmail(item.requesterEmail, item.subject, apiResult.success),
      })
    } catch (emailErr) {
      console.error('[Approve] Failed to send notification email:', emailErr)
    }

    return NextResponse.json({
      success: true,
      message: apiResult.success ? 'Approved and price updated successfully' : 'Approved but pricing API call failed',
      data: { status: item.status, apiResult },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}
