import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateCustomerPrediction } from '@/lib/prediction'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: { include: { product: true } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

// PUT: update status or editable fields
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updateData: any = {}

  if (body.status !== undefined) {
    updateData.status = body.status
    if (body.status === 'completed') {
      updateData.deliveredAt = new Date()
    }
  }
  if (body.paidAmount !== undefined) updateData.paidAmount = body.paidAmount
  if (body.note !== undefined) updateData.note = body.note
  if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod

  // Recalculate debtAmount if paidAmount or paymentMethod changes
  if (body.paidAmount !== undefined || body.paymentMethod !== undefined) {
    const existing = await prisma.order.findUnique({ where: { id: params.id } })
    if (existing) {
      const newMethod = body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod
      // Fix: cash/transfer → coi như đã trả đủ, không tính nợ
      const newPaid = newMethod !== 'debt'
        ? existing.totalAmount
        : (body.paidAmount !== undefined ? body.paidAmount : existing.paidAmount)
      const newDebt = newMethod === 'debt' ? Math.max(0, existing.totalAmount - newPaid) : 0
      updateData.debtAmount = newDebt
      updateData.paidAmount = newPaid

      // Update customer debt delta
      const debtDelta = newDebt - existing.debtAmount
      if (debtDelta !== 0) {
        await prisma.customer.update({
          where: { id: existing.customerId },
          data: { debtBalance: { increment: debtDelta } },
        })
      }
    }
  }

  const order = await prisma.order.update({
    where: { id: params.id },
    data: updateData,
    include: { customer: true, items: { include: { product: true } } },
  })

  return NextResponse.json(order)
}

// DELETE: full rollback transaction
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch customerId before transaction so it's accessible for prediction update
    const orderRef = await prisma.order.findUnique({ where: { id: params.id }, select: { customerId: true } })
    if (!orderRef) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      // Fetch order with all relations
      const order = await tx.order.findUnique({
        where: { id: params.id },
        include: {
          items: { include: { product: true } },
          customer: true,
        },
      })
      if (!order) throw new Error('Order not found')

      // STEP 1: Rollback stock for each item
      for (const item of order.items) {
        const before = item.product.stock
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        })
        await tx.stockAudit.create({
          data: {
            productId: item.productId,
            type: 'in',
            qty: item.qty,
            beforeQty: before,
            afterQty: before + item.qty,
            reason: `Hủy đơn ${order.orderNo}`,
            refId: order.id,
          },
        })
      }

      // STEP 2: Rollback cylinders
      const gasProductIds = (await tx.product.findMany({ where: { type: 'gas' } })).map(p => p.id)
      const hasGas = order.items.some(i => gasProductIds.includes(i.productId))

      if (hasGas && order.cylinderTxType) {
        const cylQty = order.items
          .filter(i => gasProductIds.includes(i.productId))
          .reduce((s, i) => s + Math.ceil(i.qty), 0)

        if (order.cylinderTxType === 'borrow') {
          // Product.stock đã được restore ở STEP 1
          // Rollback customer cylinder count and deposit/debt
          const custUpdate: any = { gasCylinderQty: { decrement: cylQty } }
          if (order.cylinderDeposit > 0) custUpdate.cylinderDeposit = { decrement: order.cylinderDeposit }
          await tx.customer.update({ where: { id: order.customerId }, data: custUpdate })

        } else if (order.cylinderTxType === 'exchange') {
          // Product.stock đã được restore ở STEP 1
          // Rollback: trừ bình rỗng đã thu (hoàn lại cho khách)
          const emptyRow = await tx.cylinderEmpty.findFirst()
          if (emptyRow) {
            await tx.cylinderEmpty.update({
              where: { id: emptyRow.id },
              data: { qty: Math.max(0, emptyRow.qty - cylQty) },
            })
          }
        }
        // bán thường: Product.stock đã xử lý đủ ở STEP 1
      }

      // STEP 3: Rollback debt
      if (order.debtAmount > 0) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { debtBalance: { decrement: order.debtAmount } },
        })
      }

      // STEP 4: Delete order (cascade deletes order items)
      await tx.order.delete({ where: { id: params.id } })
    })

    // Recalculate prediction after deletion (non-blocking, best-effort)
    try { await updateCustomerPrediction(orderRef.customerId) } catch {}

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Delete failed' }, { status: 500 })
  }
}
