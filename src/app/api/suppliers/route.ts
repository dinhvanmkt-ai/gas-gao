import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(suppliers)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, phone, address, type, notes } = body

  if (!name) {
    return NextResponse.json({ error: 'Thiếu tên nhà cung cấp' }, { status: 400 })
  }

  const supplier = await prisma.supplier.create({
    data: { name, phone, address, type: type ?? 'gas', notes },
  })

  return NextResponse.json(supplier, { status: 201 })
}
