export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const orderWhere: any = { status: { in: ['completed', 'delivered'] } }
  if (from) orderWhere.createdAt = { ...orderWhere.createdAt, gte: new Date(from) }
  if (to) orderWhere.createdAt = { ...orderWhere.createdAt, lte: new Date(to + 'T23:59:59.999') }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, type: true, unit: true } },
        },
      },
    },
  })

  // Aggregate by product
  const productMap: Record<string, {
    productId: string; name: string; type: string; unit: string
    qty: number
    grossRevenue: number   // tổng doanh thu gộp
    revenue: number        // doanh thu đã thu (tính theo tỷ lệ paid)
    totalCost: number      // tổng giá vốn từ snapshot
    missingCost: number    // số qty không có giá vốn snapshot
    costMethod: 'snapshot' | 'none'
  }> = {}

  for (const order of orders) {
    const payRatio = order.totalAmount > 0 ? (order.paidAmount / order.totalAmount) : 1

    for (const item of order.items) {
      const pid = item.productId
      if (!productMap[pid]) {
        productMap[pid] = {
          productId: pid,
          name: item.product.name,
          type: item.product.type,
          unit: item.product.unit,
          qty: 0,
          grossRevenue: 0,
          revenue: 0,
          totalCost: 0,
          missingCost: 0,
          costMethod: 'none',
        }
      }

      const p = productMap[pid]
      p.qty += item.qty
      p.grossRevenue += item.subtotal
      p.revenue += item.subtotal * payRatio

      if (item.unitCost != null && item.unitCost > 0) {
        // ✅ Dùng snapshot giá vốn lúc bán — chính xác, không bị ảnh hưởng khi giá thay đổi
        p.totalCost += item.unitCost * item.qty
        p.costMethod = 'snapshot'
      } else {
        // ⚠️ Đơn cũ chưa có snapshot → đánh dấu thiếu
        p.missingCost += item.qty
      }
    }
  }

  // Các đơn cũ chưa có unitCost snapshot → fallback tính bình quân từ PurchaseItem
  // (chỉ áp dụng cho đơn cũ, đơn mới luôn có snapshot)
  for (const p of Object.values(productMap)) {
    if (p.missingCost > 0 && p.costMethod === 'none') {
      // Fallback: bình quân gia quyền toàn lịch sử
      const allTime = await prisma.purchaseItem.findMany({
        where: { productId: p.productId, purchase: { status: 'received' } },
        select: { qty: true, unitCost: true },
      })
      if (allTime.length > 0) {
        const totalQty = allTime.reduce((s, i) => s + i.qty, 0)
        const totalVal = allTime.reduce((s, i) => s + i.qty * i.unitCost, 0)
        const avgCost = totalQty > 0 ? totalVal / totalQty : 0
        if (avgCost > 0) {
          p.totalCost += avgCost * p.missingCost
          p.costMethod = 'snapshot'  // mark as calculated (not pure snapshot)
        }
      } else {
        // Fallback cuối: Product.costPrice
        const prod = await prisma.product.findUnique({
          where: { id: p.productId },
          select: { costPrice: true },
        })
        if (prod?.costPrice != null && prod.costPrice > 0) {
          p.totalCost += prod.costPrice * p.missingCost
          p.costMethod = 'snapshot'
        }
      }
    }
  }

  const profitData = Object.values(productMap).map(p => {
    const profit = p.revenue - p.totalCost
    const unitCostAvg = p.qty > 0 ? p.totalCost / p.qty : 0
    const margin = p.grossRevenue > 0 ? (profit / p.grossRevenue) * 100 : 0
    return {
      productId: p.productId,
      name: p.name,
      type: p.type,
      unit: p.unit,
      qty: p.qty,
      grossRevenue: p.grossRevenue,
      revenue: p.revenue,
      unitCost: unitCostAvg,
      totalCost: p.totalCost,
      profit,
      margin: Math.round(margin * 10) / 10,
      costMethod: p.costMethod,
      hasMissingCost: p.missingCost > 0 && p.costMethod === 'none',
    }
  }).sort((a, b) => b.profit - a.profit)

  const totals = {
    qty: profitData.reduce((s, p) => s + p.qty, 0),
    grossRevenue: profitData.reduce((s, p) => s + p.grossRevenue, 0),
    revenue: profitData.reduce((s, p) => s + p.revenue, 0),
    totalCost: profitData.reduce((s, p) => s + p.totalCost, 0),
    profit: profitData.reduce((s, p) => s + p.profit, 0),
  }

  return NextResponse.json({ items: profitData, totals })
}
