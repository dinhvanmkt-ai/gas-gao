export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const where: Record<string, unknown> = {
    purchaseNo: { startsWith: 'NH' }
  }
  if (fromParam || toParam) {
    where.purchaseDate = {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(toParam + 'T23:59:59.999') } : {}),
    }
  }

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { purchaseDate: 'desc' }, // Fix: sort đúng theo ngày nhập, không phải ngày tạo
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
  })
  return NextResponse.json(purchases)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    supplierId, items, note, purchaseDate, paymentStatus, action,
    cylinderTxType,  // 'exchange' | 'buy' | undefined
    cylinderQty,     // số vỏ giao dịch
  } = body
  // action: 'draft' | 'confirm' (confirm → update stock)

  const isDraft = action === 'draft'
  const cylQty = Number(cylinderQty ?? 0)

  // ─── EARLY CYLINDER VALIDATION (trước khi tạo phiếu) ─────────────
  if (!isDraft && cylinderTxType === 'exchange' && cylQty > 0) {
    const emptyRow = await prisma.cylinderEmpty.findFirst()
    const availableEmpty = emptyRow?.qty ?? 0
    if (availableEmpty < cylQty) {
      return NextResponse.json(
        { error: `Kho không đủ vỏ rỗng để đổi. Hiện có: ${availableEmpty}, cần: ${cylQty}` },
        { status: 400 }
      )
    }
  }
  // ─────────────────────────────────────────────────────────────────

  // Generate purchase number — use max existing number to avoid duplicates after deletions
  const lastPurchase = await prisma.purchase.findFirst({ 
    where: { purchaseNo: { startsWith: 'NH' } },
    orderBy: { purchaseNo: 'desc' }, 
    select: { purchaseNo: true } 
  })
  const nextPNum = lastPurchase ? (parseInt(lastPurchase.purchaseNo.replace('NH', '')) || 0) + 1 : 1
  const purchaseNo = `NH${String(nextPNum).padStart(5, '0')}`

  let totalAmount = 0
  const itemsWithTotal = items.map((i: any) => {
    const subtotal = i.qty * i.unitCost
    totalAmount += subtotal
    return { ...i, subtotal }
  })

  const purchase = await prisma.purchase.create({
    data: {
      purchaseNo,
      supplierId,
      totalAmount,
      paidAmount: paymentStatus === 'paid' ? totalAmount : 0,
      note,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      paymentStatus: paymentStatus ?? 'paid',
      status: isDraft ? 'draft' : 'received',
      receivedAt: isDraft ? null : new Date(),
      cylinderTxType: cylinderTxType ?? null,
      cylinderQty: cylQty,
      items: {
        create: itemsWithTotal.map((i: any) => ({
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
    // Update stock and save price history for each item
    for (const [itemIdx, item] of itemsWithTotal.entries()) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) continue

      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.qty } },
      })

      // Save price history
      await prisma.priceHistory.create({
        data: {
          productId: item.productId,
          supplierId,
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

      // Product.stock đã được tăng ở trên → bình đầy tự động đồng bộ
    }

    // ─── CYLINDER LOGIC (Exchange → giảm vỏ rỗng, Buy → không cần làm gì thêm) ─
    if (cylinderTxType === 'exchange' && cylQty > 0) {
      // Đổi vỏ rỗng → bình đầy: giảm số vỏ rỗng tồn kho
      const emptyRow = await prisma.cylinderEmpty.findFirst()
      if (emptyRow) {
        await prisma.cylinderEmpty.update({
          where: { id: emptyRow.id },
          data: { qty: Math.max(0, emptyRow.qty - cylQty) },
        })
      }
    }
    // buy: Product.stock đã tăng ở loop trên → không cần làm thêm
    // ────────────────────────────────────────────────────────────────
  }

  return NextResponse.json(purchase, { status: 201 })
}

