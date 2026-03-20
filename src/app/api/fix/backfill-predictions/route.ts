export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateCustomerPrediction } from '@/lib/prediction'

// POST /api/fix/backfill-predictions
// Backfill prediction stats for ALL customers who have at least 1 order.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find all customers with at least 1 order
  const customers = await prisma.customer.findMany({
    where: { orders: { some: {} } },
    select: { id: true, name: true },
  })

  let updated = 0
  const errors: string[] = []

  for (const c of customers) {
    try {
      await updateCustomerPrediction(c.id)
      updated++
    } catch (e: any) {
      errors.push(`${c.name}: ${e.message}`)
    }
  }

  return NextResponse.json({
    message: `Đã cập nhật dự đoán cho ${updated}/${customers.length} khách hàng`,
    updated,
    total: customers.length,
    errors,
  })
}

