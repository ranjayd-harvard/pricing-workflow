import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { PricingQueueModel } from '@/models/PricingQueue'
import { ApiResponse, PricingQueueItem } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<PricingQueueItem>>> {
  try {
    await dbConnect()
    const { id } = await params
    const item = await PricingQueueModel.findById(id).lean() as any
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: { ...item, _id: String(item._id) } as PricingQueueItem })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<PricingQueueItem>>> {
  try {
    await dbConnect()
    const { id } = await params
    const body = await req.json()
    const item = await PricingQueueModel.findByIdAndUpdate(id, { $set: body }, { new: true }).lean() as any
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: { ...item, _id: String(item._id) } as PricingQueueItem })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
