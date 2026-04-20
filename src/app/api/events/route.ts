import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { EventModel } from '@/models/Event'

export async function GET() {
  try {
    await dbConnect()
    const events = await EventModel.find({}).sort({ updatedAt: -1 }).lean()
    return NextResponse.json({
      success: true,
      data: events.map(e => ({ ...e, _id: String(e._id) })),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    )
  }
}
