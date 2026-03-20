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

  // Move cylinders from at_customer → at_store_empty
  const customerCylinders = await prisma.cylinder.findMany({
    where: { customerId, status: 'at_customer' },
    take: returnQty,
    orderBy: { sentAt: 'asc' },
  })

  for (const c of customerCylinders) {
    await prisma.cylinder.update({
      where: { id: c.id },
      data: { status: 'at_store_empty', customerId: null, returnedAt: new Date() },
    })
  }

  // Số vỏ thực tế tìm được trong DB (có thể ít hơn returnQty)
  const actualReturned = customerCylinders.length

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
