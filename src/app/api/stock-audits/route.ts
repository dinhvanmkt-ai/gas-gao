import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '100')

  const audits = await prisma.stockAudit.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Get product names
  const productIds = Array.from(new Set(audits.map(a => a.productId)))
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, unit: true },
  })
  const productMap = Object.fromEntries(products.map(p => [p.id, p]))

  const enriched = audits.map(a => ({
    ...a,
    product: productMap[a.productId] ?? null,
  }))

  return NextResponse.json(enriched)
}
