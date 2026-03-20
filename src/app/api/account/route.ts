import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// GET: profile info
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  if (!user) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 })

  return NextResponse.json(user)
}

// PUT: update name, email, and/or password
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, email, currentPassword, newPassword } = body

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 })

  const updateData: any = {}

  // Update name
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Tên không được để trống' }, { status: 400 })
    updateData.name = name.trim()
  }

  // Update email
  if (email !== undefined && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email này đã được sử dụng' }, { status: 400 })
    updateData.email = email.trim()
  }

  // Update password
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Vui lòng nhập mật khẩu hiện tại' }, { status: 400 })
    }
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' }, { status: 400 })
    }
    updateData.password = await bcrypt.hash(newPassword, 12)
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Không có thay đổi để lưu' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  return NextResponse.json(updated)
}
