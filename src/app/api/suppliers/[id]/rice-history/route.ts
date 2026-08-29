export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/suppliers/[id]/rice-history
// Trả về lịch sử nhập gạo theo NCC: loại gạo hay nhập + giá/kg lần cuối
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supplierId = params.id

  // Lấy 20 phiếu nhập gạo gần nhất của NCC này
  const purchases = await prisma.ricePurchase.findMany({
    where: { supplierId },
    orderBy: { purchaseDate: 'desc' },
    take: 20,
    include: {
      items: {
        include: { riceProduct: { select: { id: true, name: true } } },
      },
    },
  })

  // Gom nhóm theo loại gạo → giá/kg lần nhập gần nhất
  const productMap = new Map<string, { id: string; name: string; lastPricePerKg: number; count: number }>()
  for (const p of purchases) {
    for (const item of p.items) {
      const rp = item.riceProduct
      if (!productMap.has(rp.id)) {
        productMap.set(rp.id, {
          id: rp.id,
          name: rp.name,
          lastPricePerKg: item.pricePerKg,
          count: 1,
        })
      } else {
        productMap.get(rp.id)!.count++
      }
    }
  }

  const products = Array.from(productMap.values()).sort((a, b) => b.count - a.count)

  return NextResponse.json({ products })
}
