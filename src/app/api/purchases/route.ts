import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const purchases = await prisma.purchase.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
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
    const availableEmpty = await prisma.cylinder.count({ where: { status: 'at_store_empty' } })
    if (availableEmpty < cylQty) {
      return NextResponse.json(
        { error: `Kho không đủ vỏ rỗng để đổi. Hiện có: ${availableEmpty}, cần: ${cylQty}` },
        { status: 400 }
      )
    }
  }
  // ─────────────────────────────────────────────────────────────────

  // Generate purchase number — use max existing number to avoid duplicates after deletions
  const lastPurchase = await prisma.purchase.findFirst({ orderBy: { purchaseNo: 'desc' }, select: { purchaseNo: true } })
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

      // ─── Tự động tạo vỏ bình cho sản phẩm gas ────────────────────
      // Khi nhập hàng gas (bình gas vật lý), tự động tạo Cylinder records
      if (product.type === 'gas') {
        for (let n = 1; n <= item.qty; n++) {
          const rand = Math.random().toString(36).slice(2, 6)
          const serial = `${purchaseNo}-I${itemIdx + 1}-${String(n).padStart(3, '0')}-${rand}`
          await prisma.cylinder.create({
            data: {
              serial,
              type: product.name, // dùng tên sản phẩm gas làm loại bình
              weight: 0,
              capacity: 0,
              status: 'at_store_full',
            },
          })
        }
      }
      // ────────────────────────────────────────────────────────────────
    }

    // ─── CYLINDER LOGIC (Exchange / Buy vỏ riêng với NCC) ────────────
    if (cylinderTxType && cylQty > 0) {

      if (cylinderTxType === 'exchange') {
        // Lấy vỏ rỗng trong kho → đổi thành đầy (NCC đã bơm gas lại)
        const emptyCylinders = await prisma.cylinder.findMany({
          where: { status: 'at_store_empty' },
          take: cylQty,
          orderBy: { returnedAt: 'asc' }, // ưu tiên vỏ về lâu nhất
        })
        for (const c of emptyCylinders) {
          await prisma.cylinder.update({
            where: { id: c.id },
            data: { status: 'at_store_full', updatedAt: new Date() },
          })
        }

      } else if (cylinderTxType === 'buy') {
        // Mua vỏ mới riêng (không kèm gas) → tạo bản ghi Cylinder với serial tự sinh
        for (let n = 1; n <= cylQty; n++) {
          const serial = `${purchaseNo}-VOT-${String(n).padStart(3, '0')}`
          await prisma.cylinder.create({
            data: {
              serial,
              type: 'Vỏ trống',
              weight: 0,
              capacity: 0,
              status: 'at_store_full',
            },
          })
        }
      }
    }
    // ────────────────────────────────────────────────────────────────
  }

  return NextResponse.json(purchase, { status: 201 })
}
