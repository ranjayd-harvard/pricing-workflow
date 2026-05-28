import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/db'
import { PricingQueueModel } from '@/models/PricingQueue'
import { sendEmail, buildApprovalNotificationEmail } from '@/lib/email'
import { ApiResponse } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: admin access required' }, { status: 403 })
    }

    await dbConnect()
    const { id } = await params
    const { reason = '' } = await req.json().catch(() => ({}))
    const rejectedBy = session.user.name ?? session.user.email ?? 'admin'

    const item = await PricingQueueModel.findById(id)
    if (!item) return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 })

    if (item.status !== 'pending_approval') {
      return NextResponse.json({ success: false, error: `Cannot reject item with status: ${item.status}` }, { status: 400 })
    }

    item.status = 'rejected'
    item.rejectedBy = rejectedBy
    item.rejectedAt = new Date().toISOString()
    item.rejectionReason = reason
    await item.save()

    try {
      await sendEmail({
        to: item.requesterEmail,
        subject: `Re: ${item.subject} — Pricing Request Not Approved`,
        html: buildApprovalNotificationEmail(item.requesterEmail, item.subject, false, reason),
      })
    } catch (emailErr) {
      console.error('[Reject] Failed to send notification email:', emailErr)
    }

    return NextResponse.json({ success: true, message: 'Request rejected and requester notified' })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}
