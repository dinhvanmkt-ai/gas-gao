export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET: danh sách loại bình + tổng bình rỗng
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [types, emptyRow] = await Promise.all([
    prisma.cylinderType.findMany({ orderBy: { name: 'asc' } }),
    prisma.cylinderEmpty.findFirst(),
  ])

  return NextResponse.json({
    types,
    emptyQty: emptyRow?.qty ?? 0,
    totalFull: types.reduce((s, t) => s + t.fullQty, 0),
  })
}

// POST: thêm loại bình mới
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, fullQty, note } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Tên loại bình là bắt buộc' }, { status: 400 })

  const existing = await prisma.cylinderType.findUnique({ where: { name: name.trim() } })
  if (existing) return NextResponse.json({ error: 'Loại bình này đã tồn tại' }, { status: 400 })

  const type = await prisma.cylinderType.create({
    data: { name: name.trim(), fullQty: Number(fullQty) || 0, note },
  })
  return NextResponse.json(type, { status: 201 })
}
