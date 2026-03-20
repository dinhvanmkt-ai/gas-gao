import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { serial, type, weight, capacity, brand, status } = body

  if (!serial) {
    return NextResponse.json({ error: 'Mã bình là bắt buộc' }, { status: 400 })
  }

  try {
    const updated = await prisma.cylinder.update({
      where: { id: params.id },
      data: {
        serial,
        type,
        weight,
        capacity,
        brand,
        status,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    })
    
    // Compute daysAtCustomer
    let daysAtCustomer: number | null = null
    const now = Date.now()
    if (updated.status === 'at_customer' && updated.sentAt) {
      daysAtCustomer = Math.floor((now - new Date(updated.sentAt).getTime()) / (1000 * 60 * 60 * 24))
    }
    const finalStatus = (updated.status === 'at_customer' && daysAtCustomer !== null && daysAtCustomer > 30) 
      ? 'overdue' : updated.status
      
    return NextResponse.json({ ...updated, daysAtCustomer, status: finalStatus })
  } catch (error: any) {
    console.error('Update cylinder error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Mã bình (serial) đã tồn tại' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Lỗi cập nhật vỏ bình' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cylinder = await prisma.cylinder.findUnique({ where: { id: params.id } })
    if (!cylinder) return NextResponse.json({ error: 'Không tìm thấy vỏ bình' }, { status: 404 })

    // Don't allow deletion if it's currently at a customer
    if (cylinder.status === 'at_customer') {
      return NextResponse.json({ error: 'Không thể xóa vỏ bình đang ở khách hàng' }, { status: 400 })
    }

    await prisma.cylinder.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Delete cylinder error:', error)
    return NextResponse.json({ error: 'Lỗi khi xóa vỏ bình' }, { status: 500 })
  }
}
