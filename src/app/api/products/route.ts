export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(products)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, type, unit, priceRetail, priceWhole, minStock, costPrice } = body

  const product = await prisma.product.create({
    data: {
      name: String(name).trim(),
      type: String(type),
      unit: String(unit),
      priceRetail: Number(priceRetail) || 0,
      priceWhole: priceWhole != null ? Number(priceWhole) : null,
      minStock: Number(minStock) || 0,
      costPrice: costPrice != null ? Number(costPrice) : null,
    },
  })

  // ── Tự động tạo CylinderType khi thêm sản phẩm gas ─────────────
  if (type === 'gas') {
    const existing = await prisma.cylinderType.findUnique({ where: { name: product.name } })
    if (!existing) {
      await prisma.cylinderType.create({ data: { name: product.name, fullQty: 0 } })
    }
  }
  // ──────────────────────────────────────────────────────────────────

  return NextResponse.json(product, { status: 201 })
}
