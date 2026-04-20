import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { PricingTemplateModel } from '@/models/PricingTemplate'
import { ApiResponse, PricingTemplate } from '@/types'

export async function GET(): Promise<NextResponse<ApiResponse<PricingTemplate[]>>> {
  try {
    await dbConnect()
    const templates = await PricingTemplateModel.find({}).sort({ createdAt: -1 }).lean() as any[]
    return NextResponse.json({
      success: true,
      data: templates.map(t => ({ ...t, _id: String(t._id) })) as PricingTemplate[],
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<PricingTemplate>>> {
  try {
    await dbConnect()
    const body = await req.json()

    const template = await PricingTemplateModel.create(body)
    return NextResponse.json(
      { success: true, data: { ...template.toObject(), _id: template._id.toString() } },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to create template' },
      { status: 500 }
    )
  }
}
