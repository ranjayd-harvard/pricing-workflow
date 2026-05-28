import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import dbConnect from '@/lib/db'
import { UserModel } from '@/models/User'

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  await dbConnect()

  const existing = await UserModel.findOne({ email: email.toLowerCase() })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const isFirst = (await UserModel.countDocuments()) === 0
  const hashed = await bcrypt.hash(password, 12)
  await UserModel.create({
    name,
    email: email.toLowerCase(),
    password: hashed,
    provider: 'credentials',
    role: isFirst ? 'admin' : 'viewer',
  })

  return NextResponse.json({ message: 'Account created' }, { status: 201 })
}
