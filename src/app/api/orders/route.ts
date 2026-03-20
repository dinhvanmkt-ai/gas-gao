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

  const paid = paidAmount ?? 0
  const debtAmount = Math.max(0, totalAmount - paid)

  const depositInOrder =
    cylinderTxType === 'borrow' && cylinderBorrowMode === 'deposit'
      ? (cylinderDepositAmount ?? 0)
      : 0

  // ─── TÍNH TỔNG SỐ BÌNH GAS TRONG ĐƠN ────────────────────────────
  const gasProductIds = (await prisma.product.findMany({ where: { type: 'gas' } })).map(p => p.id)
  const hasGas = itemsWithSubtotal.some((i: any) => gasProductIds.includes(i.productId))
  const totalGasQty = hasGas
    ? itemsWithSubtotal
        .filter((i: any) => gasProductIds.includes(i.productId))
        .reduce((s: number, i: any) => s + i.qty, 0)
    : 0

  // Kiểm tra kho đủ vỏ đầy để giao
  if (hasGas && totalGasQty > 0) {
    const availableFull = await prisma.cylinder.count({ where: { status: 'at_store_full' } })
    if (availableFull < totalGasQty) {
      return NextResponse.json(
        { error: `Kho không đủ vỏ bình đầy. Hiện có: ${availableFull}, cần: ${totalGasQty}` },
        { status: 400 }
      )
    }
  }
  // ──────────────────────────────────────────────────────────────────

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
        create: itemsWithSubtotal.map((i: any) => ({
          productId: i.productId,
          qty: i.qty,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
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

  // ─── CYLINDER LOGIC ───────────────────────────────────────────────
  if (hasGas && totalGasQty > 0) {
    const exchangeQty = Number(cylinderQty ?? totalGasQty)

    if (cylinderTxType === 'exchange') {
      // ── CHẾ ĐỘ ĐỔI BÌNH ──────────────────────────────────────────
      // Khách mang vỏ rỗng CỦA KHÁCH đến → cửa hàng lấy đó đổi gas mới.
      // Bình giao cho khách là TÀI SẢN CỦA KHÁCH → KHÔNG tính gasCylinderQty.

      // 1. Xuất bình đầy từ kho (at_store_full → trống tạm thời, sẽ xử lý bên dưới)
      const fullCylinders = await prisma.cylinder.findMany({
        where: { status: 'at_store_full' },
        take: totalGasQty,
      })
      // Bình đầy đã giao: vì là TÀI SẢN KHÁCH nên đánh dấu at_store_empty
      // (bình vỏ này đã rời kho nhưng chúng ta không theo dõi nó ở khách)
      for (const c of fullCylinders) {
        await prisma.cylinder.update({
          where: { id: c.id },
          data: { status: 'at_store_empty', customerId: null, sentAt: new Date() },
        })
      }

      // 2. Thu vỏ rỗng khách mang đến (những vỏ đã theo dõi được)
      const trackedCustomerCylinders = await prisma.cylinder.findMany({
        where: { customerId, status: 'at_customer' },
        take: exchangeQty,
        orderBy: { sentAt: 'asc' },
      })
      for (const c of trackedCustomerCylinders) {
        await prisma.cylinder.update({
          where: { id: c.id },
          data: { status: 'at_store_empty', customerId: null, returnedAt: new Date() },
        })
      }

      // 3. Vỏ khách mang đến chưa được theo dõi (lần đầu mua, hoặc mua từ nguồn khác)
      const untrackedQty = exchangeQty - trackedCustomerCylinders.length
      if (untrackedQty > 0) {
        const gasItem = itemsWithSubtotal.find((i: any) => gasProductIds.includes(i.productId))
        const gasProduct = gasItem ? await prisma.product.findUnique({ where: { id: gasItem.productId } }) : null
        const cylinderType = gasProduct?.name ?? 'Gas'
        for (let n = 0; n < untrackedQty; n++) {
          const rand = Math.random().toString(36).slice(2, 6)
          const serial = `${orderNo}-RET-${String(n + 1).padStart(3, '0')}-${rand}`
          await prisma.cylinder.create({
            data: { serial, type: cylinderType, weight: 0, capacity: 0, status: 'at_store_empty' },
          })
        }
      }

      // Không tăng gasCylinderQty vì cylinder này là tài sản KHÁCH, không phải của mình

    } else if (cylinderTxType === 'borrow') {
      // ── CHẾ ĐỘ MƯỢN BÌNH ─────────────────────────────────────────
      // Bình là TÀI SẢN CỬA HÀNG, giao cho khách mượn → theo dõi ở khách

      const fullCylinders = await prisma.cylinder.findMany({
        where: { status: 'at_store_full' },
        take: totalGasQty,
      })
      for (const c of fullCylinders) {
        await prisma.cylinder.update({
          where: { id: c.id },
          data: { status: 'at_customer', customerId, sentAt: new Date() },
        })
      }
      const actualSent = fullCylinders.length

      await prisma.customer.update({
        where: { id: customerId },
        data: { gasCylinderQty: { increment: actualSent } },
      })
      if (cylinderBorrowMode === 'deposit' && depositInOrder > 0) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { cylinderDeposit: { increment: depositInOrder } },
        })
      } else if (cylinderBorrowMode === 'debt') {
        await prisma.customer.update({
          where: { id: customerId },
          data: { cylinderDebt: { increment: actualSent } },
        })
      }

    } else {
      // ── BÁN THƯỜNG (không chọn loại giao dịch vỏ) ────────────────
      // Tương tự exchange: bình giao ra là tài sản khách
      const fullCylinders = await prisma.cylinder.findMany({
        where: { status: 'at_store_full' },
        take: totalGasQty,
      })
      for (const c of fullCylinders) {
        await prisma.cylinder.update({
          where: { id: c.id },
          data: { status: 'at_store_empty', customerId: null, sentAt: new Date() },
        })
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────

  // Cập nhật thống kê + dự đoán lần mua tiếp theo sau khi tạo đơn
  await updateCustomerPrediction(customerId)

  return NextResponse.json(order, { status: 201 })
}

