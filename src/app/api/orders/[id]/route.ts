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
      const newPaid = body.paidAmount !== undefined ? body.paidAmount : existing.paidAmount
      const newMethod = body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod
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
          // Return cylinders from customer back to store (full)
          const custCyls = await tx.cylinder.findMany({
            where: { customerId: order.customerId, status: 'at_customer' },
            take: cylQty,
            orderBy: { sentAt: 'desc' },
          })
          for (const c of custCyls) {
            await tx.cylinder.update({
              where: { id: c.id },
              data: { status: 'at_store_full', customerId: null, sentAt: null, returnedAt: null },
            })
          }
          // Decrement customer cylinder count and deposit/debt
          const custUpdate: any = { gasCylinderQty: { decrement: custCyls.length } }
          if (order.cylinderDeposit > 0) custUpdate.cylinderDeposit = { decrement: order.cylinderDeposit }
          await tx.customer.update({ where: { id: order.customerId }, data: custUpdate })

        } else if (order.cylinderTxType === 'exchange') {
          // Undo exchange:
          // 1. Thu hồi vỏ đầy đã giao cho khách (at_customer → at_store_full)
          const sentCyls = await tx.cylinder.findMany({
            where: { customerId: order.customerId, status: 'at_customer' },
            take: cylQty,
            orderBy: { sentAt: 'desc' },
          })
          for (const c of sentCyls) {
            await tx.cylinder.update({
              where: { id: c.id },
              data: { status: 'at_store_full', customerId: null, sentAt: null },
            })
          }
          // 2. Xóa vỏ rỗng mà khách đã đổi vào (các vỏ này không còn tồn tại thực tế)
          //    Tìm vỏ rỗng gần nhất (returnedAt mới nhất) rồi xóa
          const emptyCyls = await tx.cylinder.findMany({
            where: { status: 'at_store_empty' },
            take: cylQty,
            orderBy: { returnedAt: 'desc' },
          })
          for (const c of emptyCyls) {
            await tx.cylinder.delete({ where: { id: c.id } })
          }
        }

      } else if (hasGas) {
        // Bán thường (cylinderTxType = null): hoàn lại vỏ đầy từ khách về kho
        const cylQty = order.items
          .filter(i => gasProductIds.includes(i.productId))
          .reduce((s, i) => s + Math.ceil(i.qty), 0)

        const sentCyls = await tx.cylinder.findMany({
          where: { customerId: order.customerId, status: 'at_customer' },
          take: cylQty,
          orderBy: { sentAt: 'desc' },
        })
        for (const c of sentCyls) {
          await tx.cylinder.update({
            where: { id: c.id },
            data: { status: 'at_store_full', customerId: null, sentAt: null },
          })
        }
        if (sentCyls.length > 0) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { gasCylinderQty: { decrement: sentCyls.length } },
          })
        }
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
