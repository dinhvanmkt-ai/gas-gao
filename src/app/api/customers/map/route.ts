export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/customers/map — trả về khách hàng có tọa độ để hiển thị trên bản đồ
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customers = await prisma.customer.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    select: {
      id: true, name: true, phone: true, address: true,
      lat: true, lng: true,
      debtBalance: true, urgencyScore: true,
      gasCylinderQty: true, cylinderDebt: true,
      gasLastBuyDate: true, gasPredictedDate: true,
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(customers)
}
