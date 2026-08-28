export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [types, emptyRow] = await Promise.all([
    prisma.cylinderType.findMany({ orderBy: { name: 'asc' } }),
    prisma.cylinderEmpty.findFirst(),
  ])
  return NextResponse.json({
    types,
    emptyQty: emptyRow?.qty ?? 0,
    totalFull: types.reduce((s, t) => s + t.fullQty, 0),
  })
}

export async function POST() {
  return NextResponse.json({ error: 'Gone - use /api/cylinders endpoints for CylinderType management' }, { status: 410 })
}
