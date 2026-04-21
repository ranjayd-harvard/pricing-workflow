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

function normalizeFields(fields: any[]): any[] {
  return (fields || []).map(f => ({
    ...f,
    // Auto-derive key from label if blank
    key: f.key?.trim() || f.label?.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || '',
  }))
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<PricingTemplate>>> {
  try {
    await dbConnect()
    const body = await req.json()

    body.mandatoryFields = normalizeFields(body.mandatoryFields)
    body.optionalFields  = normalizeFields(body.optionalFields)

    const allKeys = [...body.mandatoryFields, ...body.optionalFields].map((f: any) => f.key).filter(Boolean)
    const emptyKeys = allKeys.filter((k: string) => !k)
    if (emptyKeys.length) {
      return NextResponse.json({ success: false, error: 'All fields must have a key or label set' }, { status: 400 })
    }

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
