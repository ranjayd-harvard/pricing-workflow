import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { PricingTemplateModel } from '@/models/PricingTemplate'
import { ApiResponse, PricingTemplate } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<PricingTemplate>>> {
  try {
    await dbConnect()
    const { id } = await params
    const template = await PricingTemplateModel.findById(id).lean() as any
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: { ...template, _id: String(template._id) } as PricingTemplate })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

function normalizeFields(fields: any[]): any[] {
  return (fields || []).map(f => ({
    ...f,
    key: f.key?.trim() || f.label?.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || '',
  }))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<PricingTemplate>>> {
  try {
    await dbConnect()
    const { id } = await params
    const body = await req.json()

    body.mandatoryFields = normalizeFields(body.mandatoryFields)
    body.optionalFields  = normalizeFields(body.optionalFields)

    const template = await PricingTemplateModel.findByIdAndUpdate(id, body, { new: true, runValidators: true }).lean() as any
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: { ...template, _id: String(template._id) } as PricingTemplate })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    await dbConnect()
    const { id } = await params
    await PricingTemplateModel.findByIdAndDelete(id)
    return NextResponse.json({ success: true, message: 'Template deleted' })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
