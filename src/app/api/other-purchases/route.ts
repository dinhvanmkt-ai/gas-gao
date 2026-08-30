export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/other-purchases?from=&to=
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  // Lấy phiếu nhập mà CÓ ÍT NHẤT 1 item là sản phẩm loại 'other'
  const where: Record<string, unknown> = {
    items: {
      some: {
        product: { type: 'other' },
      },
    },
  }

  if (fromParam || toParam) {
    where.purchaseDate = {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(toParam + 'T23:59:59.999') } : {}),
    }
  }

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { purchaseDate: 'desc' },
    include: {
      supplier: { select: { name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, unit: true, type: true, priceRetail: true, costPrice: true } },
        },
        where: { product: { type: 'other' } },
      },
    },
  })

  return NextResponse.json(purchases)
}

// POST /api/other-purchases
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { supplierId, items, note, purchaseDate, paymentStatus, action } = body
  // action: 'draft' | 'confirm'

  const isDraft = action === 'draft'

  if (!supplierId) {
    return NextResponse.json({ error: 'Cần chọn nhà cung cấp' }, { status: 400 })
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Cần ít nhất 1 sản phẩm' }, { status: 400 })
  }

  // Validate tất cả sản phẩm là type=other
  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) return NextResponse.json({ error: `Không tìm thấy sản phẩm ${item.productId}` }, { status: 400 })
    if (product.type !== 'other') return NextResponse.json({ error: `Sản phẩm "${product.name}" không phải loại SP Khác` }, { status: 400 })
  }

  // Generate purchase number (dùng prefix OT để phân biệt)
  const lastPurchase = await prisma.purchase.findFirst({
    where: { purchaseNo: { startsWith: 'OT' } },
    orderBy: { purchaseNo: 'desc' },
    select: { purchaseNo: true },
  })
  const nextNum = lastPurchase ? (parseInt(lastPurchase.purchaseNo.replace('OT', '')) || 0) + 1 : 1
  const purchaseNo = `OT${String(nextNum).padStart(5, '0')}`

  let totalAmount = 0
  const itemsWithTotal = items.map((i: {
    productId: string; qty: number; unitCost: number;
    priceRetail?: number; costPrice?: number
  }) => {
    const subtotal = i.qty * i.unitCost
    totalAmount += subtotal
    return { ...i, subtotal }
  })

  // Nếu không có supplierId, không truyền (null)
  const purchase = await prisma.purchase.create({
    data: {
      purchaseNo,
      supplierId,
      totalAmount,
      paidAmount: paymentStatus === 'paid' ? totalAmount : 0,
      note: note || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      paymentStatus: paymentStatus ?? 'paid',
      status: isDraft ? 'draft' : 'received',
      receivedAt: isDraft ? null : new Date(),
      items: {
        create: itemsWithTotal.map((i: {
          productId: string; qty: number; unitCost: number; subtotal: number
        }) => ({
          productId: i.productId,
          qty: i.qty,
          unitCost: i.unitCost,
          subtotal: i.subtotal,
        })),
      },
    },
    include: { items: true },
  })

  if (!isDraft) {
    for (const item of itemsWithTotal) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) continue

      // Tăng tồn kho
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.qty },
          // Cập nhật giá vốn & giá bán nếu được cung cấp
          ...(item.costPrice != null ? { costPrice: item.costPrice } : { costPrice: item.unitCost }),
          ...(item.priceRetail != null ? { priceRetail: item.priceRetail } : {}),
        },
      })

      // Ghi lịch sử giá nhập
      await prisma.priceHistory.create({
        data: {
          productId: item.productId,
          supplierId: supplierId || null,
          purchaseId: purchase.id,
          unitCost: item.unitCost,
          date: purchaseDate ? new Date(purchaseDate) : new Date(),
        },
      })

      // StockAudit log
      await prisma.stockAudit.create({
        data: {
          productId: item.productId,
          type: 'in',
          qty: item.qty,
          beforeQty: product.stock,
          afterQty: product.stock + item.qty,
          reason: `Nhập hàng ${purchaseNo}`,
          refId: purchase.id,
        },
      })
    }
  }

  return NextResponse.json(purchase, { status: 201 })
}
