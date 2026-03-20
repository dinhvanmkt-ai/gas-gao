import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/price-history?productId=xxx&limit=10
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const limit = parseInt(searchParams.get('limit') ?? '20')

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const history = await prisma.priceHistory.findMany({
    where: { productId },
    orderBy: { date: 'desc' },
    take: limit,
    include: { supplier: { select: { name: true } } },
  })
  return NextResponse.json(history)
}
