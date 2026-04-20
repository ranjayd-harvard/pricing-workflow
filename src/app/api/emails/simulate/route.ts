import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/emails/simulate
 * Simulates an inbound email for testing the workflow without a real email server.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Forward to the inbound handler
  // Use NEXT_PUBLIC_APP_URL if set, otherwise fall back to req.url base
  // This avoids SSL errors when req.url has an https:// scheme inside Docker
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    || `http://localhost:${process.env.PORT || 3041}`
  const inboundRes = await fetch(
    `${baseUrl}/api/emails/inbound`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: body.from || 'Test User <test@example.com>',
        to: body.to || process.env.PRICING_EMAIL,
        subject: body.subject || 'Pricing Update Request',
        text: body.body || '',
        messageId: `sim-${Date.now()}@pricing-workflow`,
      }),
    }
  )

  const data = await inboundRes.json()
  return NextResponse.json(data, { status: inboundRes.status })
}
