import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { PricingQueueModel } from '@/models/PricingQueue'
import { ApiResponse, PricingQueueItem } from '@/types'

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<{ items: PricingQueueItem[]; total: number; stats: Record<string, number> }>>> {
  try {
    await dbConnect()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const filter: Record<string, unknown> = {}
    if (status && status !== 'all') filter.status = status

    const [items, total, statsCursor] = await Promise.all([
      PricingQueueModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean() as Promise<any[]>,
      PricingQueueModel.countDocuments(filter),
      PricingQueueModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ])

    const stats: Record<string, number> = {}
    for (const s of statsCursor) {
      stats[s._id] = s.count
    }

    return NextResponse.json({
      success: true,
      data: {
        items: items.map(i => ({ ...i, _id: String(i._id) })) as PricingQueueItem[],
        total,
        stats,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch queue' },
      { status: 500 }
    )
  }
}
