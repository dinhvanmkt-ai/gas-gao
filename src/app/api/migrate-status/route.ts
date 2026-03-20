import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// One-time migration endpoint: delivered/cancelled → completed
export async function GET() {
  const r1 = await prisma.order.updateMany({ where: { status: 'delivered' }, data: { status: 'completed' } })
  const r2 = await prisma.order.updateMany({ where: { status: 'cancelled' }, data: { status: 'completed' } })
  return NextResponse.json({ migratedDelivered: r1.count, migratedCancelled: r2.count })
}
