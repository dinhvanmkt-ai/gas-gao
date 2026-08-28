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
          product: { select: { id: true, name: true, type: true, unit: true, costPrice: true } },
        },
      },
    },
  })

  // Aggregate by product
  const productMap: Record<string, {
    productId: string; name: string; type: string; unit: string
    qty: number; revenue: number; grossRevenue: number
    costPriceManual: number | null  // từ Product.costPrice
  }> = {}

  for (const order of orders) {
    const payRatio = order.totalAmount > 0 ? (order.paidAmount / order.totalAmount) : 1
    for (const item of order.items) {
      if (!productMap[item.productId]) {
        productMap[item.productId] = {
          productId: item.productId,
          name: item.product.name,
          type: item.product.type,
          unit: item.product.unit,
          qty: 0,
          revenue: 0,
          grossRevenue: 0,
          costPriceManual: item.product.costPrice,
        }
      }
      productMap[item.productId].qty += item.qty
      productMap[item.productId].grossRevenue += item.subtotal
      productMap[item.productId].revenue += item.subtotal * payRatio
    }
  }

  // Giá vốn theo sản phẩm
  const productIds = Object.keys(productMap)
  const costs: Record<string, number> = {}
  const costMethods: Record<string, string> = {}

  const purchaseDateFilter: any = { purchase: { status: 'received' } }
  if (from || to) {
    purchaseDateFilter.purchase.purchaseDate = {}
    if (from) purchaseDateFilter.purchase.purchaseDate.gte = new Date(from)
    if (to) purchaseDateFilter.purchase.purchaseDate.lte = new Date(to + 'T23:59:59.999')
  }

  for (const pid of productIds) {
    const p = productMap[pid]

    // Ưu tiên 1: costPrice nhập tay (cho mọi loại sản phẩm)
    if (p.costPriceManual != null && p.costPriceManual > 0) {
      costs[pid] = p.costPriceManual
      costMethods[pid] = 'manual'
      continue
    }

    // Ưu tiên 2: bình quân gia quyền từ PurchaseItem trong kỳ (chủ yếu cho gas)
    const inPeriod = await prisma.purchaseItem.findMany({
      where: { productId: pid, ...purchaseDateFilter },
      select: { qty: true, unitCost: true },
    })
    if (inPeriod.length > 0) {
      const totalQty = inPeriod.reduce((s, i) => s + i.qty, 0)
      const totalCostVal = inPeriod.reduce((s, i) => s + i.qty * i.unitCost, 0)
      costs[pid] = totalQty > 0 ? totalCostVal / totalQty : 0
      costMethods[pid] = 'avg_period'
      continue
    }

    // Ưu tiên 3: bình quân toàn bộ lịch sử nhập
    const allTime = await prisma.purchaseItem.findMany({
      where: { productId: pid, purchase: { status: 'received' } },
      select: { qty: true, unitCost: true },
    })
    if (allTime.length > 0) {
      const totalQty = allTime.reduce((s, i) => s + i.qty, 0)
      const totalCostVal = allTime.reduce((s, i) => s + i.qty * i.unitCost, 0)
      costs[pid] = totalQty > 0 ? totalCostVal / totalQty : 0
      costMethods[pid] = 'avg_all'
      continue
    }

    // Ưu tiên 4: chưa có giá vốn
    costs[pid] = 0
    costMethods[pid] = 'none'
  }

  const profitData = Object.values(productMap).map(p => {
    const unitCost = costs[p.productId] ?? 0
    const totalCost = unitCost * p.qty
    const profit = p.revenue - totalCost
    const margin = p.grossRevenue > 0 ? (profit / p.grossRevenue) * 100 : 0
    return {
      ...p,
      unitCost,
      totalCost,
      profit,
      margin: Math.round(margin * 10) / 10,
      costMethod: costMethods[p.productId] ?? 'none',
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

