import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cylinders = await prisma.cylinder.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  })

  // Compute days at customer
  const now = Date.now()
  const enriched = cylinders.map((c) => {
    let daysAtCustomer: number | null = null
    if (c.status === 'at_customer' && c.sentAt) {
      daysAtCustomer = Math.floor((now - new Date(c.sentAt).getTime()) / (1000 * 60 * 60 * 24))
    }
    // Auto-detect overdue (>30 days at customer)
    let status = c.status
    if (c.status === 'at_customer' && daysAtCustomer !== null && daysAtCustomer > 30) {
      status = 'overdue'
    }
    return { ...c, daysAtCustomer, status }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { serial, type, weight, capacity, brand, status } = body

  if (!serial) {
    return NextResponse.json({ error: 'Mã bình là bắt buộc' }, { status: 400 })
  }

  const cylinder = await prisma.cylinder.create({
    data: {
      serial,
      type: type ?? '12kg',
      weight: weight ?? 0,
      capacity: capacity ?? parseFloat(type ?? '12'),
      brand,
      status: status ?? 'at_store_full',
    },
  })

  return NextResponse.json(cylinder, { status: 201 })
}
