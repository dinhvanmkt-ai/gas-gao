export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Bình đầy = Product(type=gas).stock — không còn CylinderType
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [gasProducts, emptyRow] = await Promise.all([
    prisma.product.findMany({ where: { type: 'gas' }, select: { id: true, name: true, stock: true }, orderBy: { name: 'asc' } }),
    prisma.cylinderEmpty.findFirst(),
  ])
  const types = gasProducts.map(p => ({ id: p.id, name: p.name, fullQty: Math.max(0, Math.floor(p.stock)) }))
  return NextResponse.json({
    types,
    emptyQty: emptyRow?.qty ?? 0,
    totalFull: types.reduce((s: number, t: { fullQty: number }) => s + t.fullQty, 0),
  })
}

export async function POST() {
  return NextResponse.json({ error: 'Gone - use /api/products to manage gas products' }, { status: 410 })
}
