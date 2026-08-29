export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateCustomerPrediction } from '@/lib/prediction'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? {
        OR: [
          { orderNo: { contains: q } },
          { customer: { name: { contains: q } } },
        ],
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      customer: { select: { name: true, phone: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
  })

  return NextResponse.json(orders)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    customerId, paymentMethod, paidAmount, note, items,
    orderDate,             // ngày mua hàng (tùy chọn, mặc định hôm nay)
    cylinderTxType,        // 'exchange' | 'borrow' | undefined
    cylinderQty,           // số vỏ giao dịch (dùng cho exchange)
    cylinderDepositAmount, // tiền cọ (chỉ khi borrow + deposit)
    cylinderBorrowMode,    // 'deposit' | 'debt'
  } = body

  // Ngày tạo đơn hàng: nếu có orderDate từ form thì dùng nó, ngoài ra dùng thời điểm hiện tại
  const orderCreatedAt = orderDate ? new Date(orderDate + 'T08:00:00') : new Date()

  if (!customerId || !items?.length) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  // ─── VALIDATE TỒN KHO trước khi tạo đơn ──────────────────────────
  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 400 })
    if (product.stock < item.qty) {
      return NextResponse.json(
        { error: `Sản phẩm "${product.name}" không đủ tồn kho. Còn: ${product.stock}, cần: ${item.qty}` },
        { status: 400 }
      )
    }
  }
  // ──────────────────────────────────────────────────────────────────

  // Generate order number — use max existing number to avoid duplicates after deletions
  const lastOrder = await prisma.order.findFirst({ orderBy: { orderNo: 'desc' }, select: { orderNo: true } })
  const nextNum = lastOrder ? (parseInt(lastOrder.orderNo.replace('DH', '')) || 0) + 1 : 1
  const orderNo = `DH${String(nextNum).padStart(5, '0')}`

  // Calculate totals
  let totalAmount = 0
  const itemsWithSubtotal = items.map((item: any) => {
    const subtotal = item.qty * item.unitPrice
    totalAmount += subtotal
    return { ...item, subtotal }
  })

  // ── FIX Bug #1: cash / transfer → coi như đã trả đủ, không tạo nợ ──────────
  // Trước đây paidAmount không được nhập khi chọn cash/transfer → paid = 0 → toàn bộ bị ghi nợ sai
  const paid = paymentMethod !== 'debt' ? totalAmount : Math.max(0, paidAmount ?? 0)
  const debtAmount = paymentMethod !== 'debt' ? 0 : Math.max(0, totalAmount - paid)
  // ─────────────────────────────────────────────────────────────────────────────

  // ─── TÍNH TỔNG SỐ BÌNH GAS TRONG ĐƠN ────────────────────────────
  const gasProductIds = (await prisma.product.findMany({ where: { type: 'gas' } })).map(p => p.id)
  const hasGas = itemsWithSubtotal.some((i: any) => gasProductIds.includes(i.productId))
  const totalGasQty = hasGas
    ? itemsWithSubtotal
        .filter((i: any) => gasProductIds.includes(i.productId))
        .reduce((s: number, i: any) => s + i.qty, 0)
    : 0

  // ── FIX Bug #2: lưu TỔNG tiền cọc (per-vỏ × số bình gas) thay vì per-vỏ ──
  // Trước đây chỉ lưu cylinderDepositAmount (per vỏ) → mượn 3 vỏ × 200k chỉ ghi 200k, mất 400k
  const depositInOrder =
    cylinderTxType === 'borrow' && cylinderBorrowMode === 'deposit'
      ? (cylinderDepositAmount ?? 0) * Math.max(1, totalGasQty)
      : 0
  // ─────────────────────────────────────────────────────────────────

  // ── Validation kho bình đầy: đã được validate per-product ở loop trên (stock < qty) ──
  // Không cần validate thêm vì Product.stock chính là số bình đầy


  // ── Tính unitCost snapshot cho từng sản phẩm (giá vốn tại thời điểm bán) ──
  // Không bao giờ thay đổi sau khi đơn được tạo, dù giá nhập/bán thay đổi sau này
  async function getUnitCostSnapshot(productId: string, saleDate: Date): Promise<number | null> {
    // 1. costPrice nhập tay
    const prod = await prisma.product.findUnique({ where: { id: productId }, select: { costPrice: true } })
    if (prod?.costPrice != null && prod.costPrice > 0) return prod.costPrice

    // 2. Bình quân gia quyền các lô nhập trước ngày bán
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: {
        productId,
        purchase: { status: 'received', purchaseDate: { lte: saleDate } },
      },
      select: { qty: true, unitCost: true },
    })
    if (purchaseItems.length > 0) {
      const totalQty = purchaseItems.reduce((s, i) => s + i.qty, 0)
      const totalVal = purchaseItems.reduce((s, i) => s + i.qty * i.unitCost, 0)
      return totalQty > 0 ? totalVal / totalQty : null
    }

    return null  // chưa có giá vốn
  }

  // Tính snapshot cho tất cả items
  const itemsWithCost = await Promise.all(
    itemsWithSubtotal.map(async (i: any) => ({
      ...i,
      unitCost: await getUnitCostSnapshot(i.productId, orderCreatedAt),
    }))
  )
  // ────────────────────────────────────────────────────────────────────────────

  const order = await prisma.order.create({
    data: {
      orderNo,
      customerId,
      paymentMethod: paymentMethod ?? 'cash',
      totalAmount,
      paidAmount: paid,
      debtAmount,
      note,
      status: 'pending',
      createdAt: orderCreatedAt,   // ← áp dụng ngày do người dùng chọn
      cylinderTxType: cylinderTxType ?? null,
      cylinderDeposit: depositInOrder,
      items: {
        create: itemsWithCost.map((i: any) => ({
          productId: i.productId,
          qty: i.qty,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
          unitCost: i.unitCost,   // ← snapshot giá vốn
        })),
      },
    },
    include: { items: true },
  })

  // Update stock
  for (const item of itemsWithSubtotal) {
    const productBefore = await prisma.product.findUnique({ where: { id: item.productId } })
    const beforeQty = productBefore?.stock ?? 0
    const afterQty = Math.max(0, beforeQty - item.qty)
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.qty } },
    })
    await prisma.stockAudit.create({
      data: {
        productId: item.productId,
        type: 'out',
        qty: item.qty,
        beforeQty,
        afterQty,
        reason: `Bán hàng ${orderNo}`,
        refId: order.id,
      },
    })
  }

  // Update customer debt
  if (debtAmount > 0) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { debtBalance: { increment: debtAmount } },
    })
  }

  // ─── CYLINDER LOGIC ─────────────────────────────────────────────
  // Product.stock đã được trừ bởi stock update loop ở trên.
  // Ở đây chỉ xử lý: thu vỏ rỗng về (exchange) + thông tin khách mượn (borrow)
  if (hasGas && totalGasQty > 0) {

    if (cylinderTxType === 'exchange') {
      // Thu vỏ rỗng về kho (không phân loại)
      const exchangeQty = Number(cylinderQty ?? totalGasQty)
      const emptyRow = await prisma.cylinderEmpty.findFirst()
      if (emptyRow) {
        await prisma.cylinderEmpty.update({
          where: { id: emptyRow.id },
          data: { qty: { increment: exchangeQty } },
        })
      } else {
        await prisma.cylinderEmpty.create({ data: { qty: exchangeQty } })
      }

    } else if (cylinderTxType === 'borrow') {
      // Ghi nhận khách mượn bình + cọc/nợ
      await prisma.customer.update({
        where: { id: customerId },
        data: { gasCylinderQty: { increment: totalGasQty } },
      })
      if (cylinderBorrowMode === 'deposit' && depositInOrder > 0) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { cylinderDeposit: { increment: depositInOrder } },
        })
      } else if (cylinderBorrowMode === 'debt') {
        await prisma.customer.update({
          where: { id: customerId },
          data: { cylinderDebt: { increment: totalGasQty } },
        })
      }
    }
    // exchange/bán thường: Product.stock đã xử lý đủ
  }
  // ─────────────────────────────────────────────────────────────────



  // Cập nhật thống kê + dự đoán lần mua tiếp theo sau khi tạo đơn
  await updateCustomerPrediction(customerId)

  return NextResponse.json(order, { status: 201 })
}

