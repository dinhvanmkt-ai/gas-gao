import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { items: { include: { product: true } } },
      },
      cylinders: true,
    },
  })

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(customer)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: body,
  })
  return NextResponse.json(customer)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Check for linked orders
    const orderCount = await prisma.order.count({ where: { customerId: params.id } })
    if (orderCount > 0) {
      return NextResponse.json(
        { error: `Không thể xóa: khách hàng có ${orderCount} đơn hàng. Hãy xóa đơn hàng trước.` },
        { status: 409 }
      )
    }

    // Check for cylinders
    const cylinderCount = await prisma.cylinder.count({ where: { customerId: params.id } })
    if (cylinderCount > 0) {
      return NextResponse.json(
        { error: `Không thể xóa: khách hàng đang giữ ${cylinderCount} vỏ bình gas.` },
        { status: 409 }
      )
    }

    await prisma.customer.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Delete customer error:', e)
    return NextResponse.json({ error: 'Lỗi xóa khách hàng: ' + (e.message ?? 'Unknown error') }, { status: 500 })
  }
}
