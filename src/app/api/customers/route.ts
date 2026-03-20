import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const sort = searchParams.get('sort') ?? 'urgency'

  const customers = await prisma.customer.findMany({
    where: q ? {
      OR: [
        { name: { contains: q } },
        { phone: { contains: q } },
        { address: { contains: q } },
      ],
    } : undefined,
    orderBy: sort === 'urgency'
      ? { urgencyScore: 'desc' }
      : sort === 'name'
        ? { name: 'asc' }
        : { createdAt: 'desc' },
  })

  return NextResponse.json(customers)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, phone, address, notes, gasCylinderQty } = body

  if (!name || !phone) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
  }

  const customer = await prisma.customer.create({
    data: {
      name,
      phone,
      address,
      notes,
      gasCylinderQty: gasCylinderQty ?? 0,
    },
  })

  return NextResponse.json(customer, { status: 201 })
}
