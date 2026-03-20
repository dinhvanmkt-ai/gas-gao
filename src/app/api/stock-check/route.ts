export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { items } = body
  // items: [{ productId, actualQty, reason? }]

  if (!items?.length) {
    return NextResponse.json({ error: 'Không có dữ liệu kiểm kê' }, { status: 400 })
  }

  const results = []

  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) continue

    const diff = item.actualQty - product.stock
    if (diff === 0) continue

    // Create adjustment audit
    await prisma.stockAudit.create({
      data: {
        productId: item.productId,
        type: 'adjust',
        qty: Math.abs(diff),
        beforeQty: product.stock,
        afterQty: item.actualQty,
        reason: item.reason || `Kiểm kê: ${diff > 0 ? 'thừa' : 'thiếu'} ${Math.abs(diff)}`,
      },
    })

    // Update actual stock
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: item.actualQty },
    })

    results.push({
      productId: item.productId,
      name: product.name,
      before: product.stock,
      after: item.actualQty,
      diff,
    })
  }

  return NextResponse.json({ adjusted: results.length, results })
}

