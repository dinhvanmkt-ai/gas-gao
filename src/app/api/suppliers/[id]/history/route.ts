export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/suppliers/[id]/history
// Trả về lịch sử nhập hàng theo NCC: sản phẩm hay nhập + giá lần cuối
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supplierId = params.id

  // Lấy 20 phiếu nhập gần nhất của NCC này
  const purchases = await prisma.purchase.findMany({
    where: { supplierId },
    orderBy: { purchaseDate: 'desc' },
    take: 20,
    include: {
      items: {
        include: { product: { select: { id: true, name: true, unit: true, type: true } } },
      },
    },
  })

  // Gom nhóm theo sản phẩm → lấy giá lần nhập gần nhất
  const productMap = new Map<string, { id: string; name: string; unit: string; type: string; lastUnitCost: number; count: number }>()
  for (const p of purchases) {
    for (const item of p.items) {
      const prod = item.product
      if (!productMap.has(prod.id)) {
        productMap.set(prod.id, {
          id: prod.id,
          name: prod.name,
          unit: prod.unit,
          type: prod.type,
          lastUnitCost: item.unitCost,
          count: 1,
        })
      } else {
        productMap.get(prod.id)!.count++
        // Giá đã là lần mới nhất vì sort theo purchaseDate desc
      }
    }
  }

  // Sort: sản phẩm hay nhập nhất lên đầu
  const products = Array.from(productMap.values()).sort((a, b) => b.count - a.count)

  return NextResponse.json({ products })
}
