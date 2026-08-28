import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PUT: cập nhật fullQty hoặc tên
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, fullQty, note } = await req.json()
  const type = await prisma.cylinderType.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(fullQty !== undefined ? { fullQty: Math.max(0, Number(fullQty)) } : {}),
      ...(note !== undefined ? { note } : {}),
    },
  })
  return NextResponse.json(type)
}

// DELETE: xóa loại bình (chỉ khi fullQty = 0)
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = await prisma.cylinderType.findUnique({ where: { id: params.id } })
  if (!type) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
  if (type.fullQty > 0) {
    return NextResponse.json(
      { error: `Không thể xóa — còn ${type.fullQty} bình đầy trong kho` },
      { status: 400 }
    )
  }

  await prisma.cylinderType.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
