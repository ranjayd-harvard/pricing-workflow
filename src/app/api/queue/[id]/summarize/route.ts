import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { PricingQueueModel } from '@/models/PricingQueue'
import { PricingTemplateModel } from '@/models/PricingTemplate'
import { summarizeEmailWithGemini, mapToPricingTemplate } from '@/lib/gemini'
import { ApiResponse } from '@/types'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    await dbConnect()
    const { id } = await params

    const item = await PricingQueueModel.findById(id)
    if (!item) return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 })

    const template = await PricingTemplateModel.findById(item.templateId)
    if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })

    // Use the latest email body from the thread
    const latestBody = item.emailThread.length > 0
      ? item.emailThread[item.emailThread.length - 1].body
      : item.originalEmailBody

    const { summary, extractedData } = await summarizeEmailWithGemini(
      latestBody,
      template.name,
      template.mandatoryFields
    )

    const mappedData = mapToPricingTemplate(extractedData, summary, [
      ...template.mandatoryFields,
      ...(template.optionalFields || []),
    ])

    item.summary = summary
    item.extractedData = extractedData
    item.mappedData = mappedData
    item.status = 'pending_approval'
    await item.save()

    return NextResponse.json({
      success: true,
      message: 'Re-summarized and mapped successfully',
      data: { summary, extractedData, mappedData },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}
