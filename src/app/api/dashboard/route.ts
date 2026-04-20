import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { PricingQueueModel } from '@/models/PricingQueue'
import { PricingTemplateModel } from '@/models/PricingTemplate'

export async function GET() {
  try {
    await dbConnect()

    const [statusAgg, templates, recentItems] = await Promise.all([
      PricingQueueModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      PricingTemplateModel.find({}).select('name targetCollection active').lean(),
      PricingQueueModel.find({}).sort({ createdAt: -1 }).limit(8).lean() as Promise<any[]>,
    ])

    const stats: Record<string, number> = {}
    let total = 0
    for (const s of statusAgg) {
      stats[s._id] = s.count
      total += s.count
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        total,
        activeTemplates: templates.filter((t: any) => t.active).length,
        templates: templates.map((t: any) => ({ _id: String(t._id), name: t.name, targetCollection: t.targetCollection, active: t.active })),
        recentItems: recentItems.map(i => ({ ...i, _id: String(i._id) })),
      },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}
