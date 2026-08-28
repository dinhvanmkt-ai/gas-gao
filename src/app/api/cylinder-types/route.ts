export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET: bình đầy = lấy từ Product(type=gas).stock — single source of truth
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [gasProducts, emptyRow] = await Promise.all([
    prisma.product.findMany({
      where: { type: 'gas' },
      select: { id: true, name: true, stock: true },
      orderBy: { name: 'asc' },
    }),
    prisma.cylinderEmpty.findFirst(),
  ])

  // Map gas products thành format "types" để UI không cần thay đổi nhiều
  const types = gasProducts.map(p => ({
    id: p.id,
    name: p.name,
    fullQty: Math.max(0, Math.floor(p.stock)), // stock = số bình đầy
  }))

  return NextResponse.json({
    types,
    emptyQty: emptyRow?.qty ?? 0,
    totalFull: types.reduce((s, t) => s + t.fullQty, 0),
  })
}

// POST: không còn dùng (thêm loại bình = thêm sản phẩm gas)
export async function POST() {
  return NextResponse.json(
    { error: 'Dùng /api/products để thêm sản phẩm gas mới' },
    { status: 410 }
  )
}
