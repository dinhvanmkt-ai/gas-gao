export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET: tổng bình rỗng
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let row = await prisma.cylinderEmpty.findFirst()
  if (!row) row = await prisma.cylinderEmpty.create({ data: { qty: 0 } })
  return NextResponse.json(row)
}

// PUT: set số lượng bình rỗng (điều chỉnh thủ công)
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { qty, delta } = await req.json()

  let row = await prisma.cylinderEmpty.findFirst()
  if (!row) row = await prisma.cylinderEmpty.create({ data: { qty: 0 } })

  let newQty: number
  if (delta !== undefined) {
    // delta mode: +N hoặc -N
    newQty = Math.max(0, row.qty + Number(delta))
  } else {
    // set mode: đặt thẳng
    newQty = Math.max(0, Number(qty))
  }

  const updated = await prisma.cylinderEmpty.update({
    where: { id: row.id },
    data: { qty: newQty },
  })
  return NextResponse.json(updated)
}
