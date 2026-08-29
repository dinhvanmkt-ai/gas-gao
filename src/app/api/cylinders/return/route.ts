export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/cylinders/return
 * Body: { customerId, qty, returnMode: 'deposit' | 'debt' }
 * Khách trả bình mượn về:
 * - Bình đầy = Product.stock (tăng stock của gas product tương ứng, hoặc tăng vỏ rỗng nếu trả rỗng)
 * - Giảm customer.gasCylinderQty + xử lý cọc/nợ
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

  // Bình trả về → cộng vào vỏ rỗng (vì không biết loại, chờ nạp lại)
  const emptyRow = await prisma.cylinderEmpty.findFirst()
  if (emptyRow) {
    await prisma.cylinderEmpty.update({
      where: { id: emptyRow.id },
      data: { qty: { increment: returnQty } },
    })
  } else {
    await prisma.cylinderEmpty.create({ data: { qty: returnQty } })
  }

  const actualReturned = returnQty
  const newCylinderQty = Math.max(0, customer.gasCylinderQty - actualReturned)

  let refundedDeposit = 0
  const customerUpdate: any = { gasCylinderQty: newCylinderQty }

  if (returnMode === 'deposit') {
    refundedDeposit = customer.gasCylinderQty > 0
      ? (customer.cylinderDeposit / customer.gasCylinderQty) * actualReturned
      : 0
    customerUpdate.cylinderDeposit = Math.max(0, customer.cylinderDeposit - refundedDeposit)
  } else if (returnMode === 'debt') {
    customerUpdate.cylinderDebt = Math.max(0, customer.cylinderDebt - actualReturned)
  }

  await prisma.customer.update({ where: { id: customerId }, data: customerUpdate })

  return NextResponse.json({
    success: true,
    returned: actualReturned,
    newCylinderQty,
    refundedDeposit: Math.round(refundedDeposit),
  })
}
