export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/cylinders/return
 * Body: { customerId, qty, returnMode: 'deposit' | 'debt' }
 * - qty: số vỏ trả
 * - returnMode: 'deposit' = hoàn cọc, 'debt' = xóa nợ vỏ
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customerId, qty, returnMode } = body

  if (!customerId || !qty || qty <= 0) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return NextResponse.json({ error: 'Không tìm thấy khách hàng' }, { status: 404 })

  const returnQty = Number(qty)

  // Update aggregate inventory: increment emptyQty and decrement customer cylinder count
  const [firstType, emptyRow] = await Promise.all([
    prisma.cylinderType.findFirst({ orderBy: { name: 'asc' } }),
    prisma.cylinderEmpty.findFirst(),
  ])

  // Hoàn trả vỏ về kho: tăng số bình đầy (giả sử bình được nạp lại khi trả)
  if (firstType && returnQty > 0) {
    await prisma.cylinderType.update({
      where: { id: firstType.id },
      data: { fullQty: { increment: returnQty } },
    })
  }

  // Tăng số vỏ rỗng trong kho
  if (emptyRow) {
    await prisma.cylinderEmpty.update({
      where: { id: emptyRow.id },
      data: { qty: { increment: returnQty } },
    })
  }

  // Số vỏ thực tế trả (bằng qty yêu cầu vì dùng aggregate)
  const actualReturned = returnQty

  // Update customer cylinder count dựa trên số vỏ thực tế
  const newCylinderQty = Math.max(0, customer.gasCylinderQty - actualReturned)

  // Tính số tiền hoàn cọc tỷ lệ theo số vỏ thực tế
  let refundedDeposit = 0

  const customerUpdate: any = { gasCylinderQty: newCylinderQty }

  if (returnMode === 'deposit') {
    // Hoàn cọc tỷ lệ theo số vỏ thực tế, tránh chia 0
    refundedDeposit = customer.gasCylinderQty > 0
      ? (customer.cylinderDeposit / customer.gasCylinderQty) * actualReturned
      : 0
    customerUpdate.cylinderDeposit = Math.max(0, customer.cylinderDeposit - refundedDeposit)
  } else if (returnMode === 'debt') {
    // Xóa nợ vỏ theo số vỏ thực tế
    customerUpdate.cylinderDebt = Math.max(0, customer.cylinderDebt - actualReturned)
  }

  await prisma.customer.update({ where: { id: customerId }, data: customerUpdate })

  return NextResponse.json({
    success: true,
    returned: actualReturned,
    newCylinderQty,
    refundedDeposit: Math.round(refundedDeposit),
    ...(actualReturned < returnQty ? { warning: `Chỉ tìm được ${actualReturned}/${returnQty} vỏ trong hệ thống` } : {}),
  })
}

