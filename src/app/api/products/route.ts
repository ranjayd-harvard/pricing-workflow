import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { ProductModel } from '@/models/Product'

export async function GET() {
  try {
    await dbConnect()
    const products = await ProductModel.find({}).sort({ updatedAt: -1 }).lean()
    return NextResponse.json({
      success: true,
      data: products.map(p => ({ ...p, _id: String(p._id) })),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}
