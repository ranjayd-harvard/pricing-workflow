import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/db'
import { UserModel } from '@/models/User'

function forbidden() {
  return NextResponse.json({ success: false, error: 'Forbidden: admin access required' }, { status: 403 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') return forbidden()

  await dbConnect()
  const users = await UserModel.find({}).select('-password').sort({ createdAt: 1 }).lean()
  return NextResponse.json({ success: true, data: users })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') return forbidden()

  const { userId, role } = await req.json()
  if (!userId || !['admin', 'viewer'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Invalid userId or role' }, { status: 400 })
  }
  // Prevent self-demotion
  if (userId === session.user.id && role === 'viewer') {
    return NextResponse.json({ success: false, error: 'You cannot demote yourself' }, { status: 400 })
  }

  await dbConnect()
  await UserModel.findByIdAndUpdate(userId, { role })
  return NextResponse.json({ success: true, message: `Role updated to ${role}` })
}
