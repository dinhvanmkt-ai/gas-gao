export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/other-purchases/[id]
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const purchase = await prisma.purchase.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      items: {
        include: {
          product: { select: { id: true, name: true, unit: true, type: true, priceRetail: true, costPrice: true } },
        },
      },
    },
  })
  if (!purchase) return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 })

  return NextResponse.json(purchase)
}

// PUT /api/other-purchases/[id]  — cập nhật trạng thái thanh toán
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { paymentStatus } = body

  const purchase = await prisma.purchase.update({
    where: { id: params.id },
    data: {
      paymentStatus,
      paidAmount: paymentStatus === 'paid'
        ? (await prisma.purchase.findUnique({ where: { id: params.id }, select: { totalAmount: true } }))?.totalAmount ?? 0
        : 0,
    },
  })
  return NextResponse.json(purchase)
}

// DELETE /api/other-purchases/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const purchase = await prisma.purchase.findUnique({
    where: { id: params.id },
    include: { items: true },
  })
  if (!purchase) return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 })

  // Nếu đã nhập kho → hoàn tác tồn kho
  if (purchase.status === 'received') {
    for (const item of purchase.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) continue

      const afterQty = Math.max(0, product.stock - item.qty)
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: afterQty },
      })

      await prisma.stockAudit.create({
        data: {
          productId: item.productId,
          type: 'out',
          qty: item.qty,
          beforeQty: product.stock,
          afterQty,
          reason: `Xóa phiếu nhập ${purchase.purchaseNo}`,
          refId: purchase.id,
        },
      })
    }
  }

  // Xóa price history liên quan
  await prisma.priceHistory.deleteMany({ where: { purchaseId: params.id } })

  // Xóa phiếu (cascade xóa items)
  await prisma.purchase.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
