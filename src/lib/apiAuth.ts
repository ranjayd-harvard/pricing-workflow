import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  if (session.user.role !== 'admin') {
    return { error: NextResponse.json({ success: false, error: 'Forbidden: admin access required' }, { status: 403 }) }
  }
  return { session }
}
