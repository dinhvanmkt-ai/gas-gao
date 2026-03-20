import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const product = await prisma.product.findUnique({ where: { id: params.id } })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, type, unit, priceRetail, priceWhole, minStock } = body

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      name,
      type,
      unit,
      priceRetail: Number(priceRetail) || 0,
      priceWhole: priceWhole != null ? Number(priceWhole) : null,
      minStock: Number(minStock) || 0,
    },
  })
  return NextResponse.json(product)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if product has orders or purchase items
  const orderCount = await prisma.orderItem.count({ where: { productId: params.id } })
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `Không thể xóa — sản phẩm đang có ${orderCount} đơn hàng liên quan` },
      { status: 400 }
    )
  }

  await prisma.product.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
