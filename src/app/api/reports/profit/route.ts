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

  // Build order filter — use paidAmount-based revenue (cash in hand)
  const orderWhere: any = { status: { in: ['completed', 'delivered'] } }
  if (from) orderWhere.createdAt = { ...orderWhere.createdAt, gte: new Date(from) }
  if (to) orderWhere.createdAt = { ...orderWhere.createdAt, lte: new Date(to + 'T23:59:59.999') }

  // Get completed orders with items
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

  // Aggregate by product — use paidAmount proportionally for revenue
  // Revenue per item = (paidAmount / totalAmount) * item.subtotal
  const productMap: Record<string, {
    productId: string
    name: string
    type: string
    unit: string
    qty: number
    revenue: number   // proportional paid revenue
    grossRevenue: number  // full invoice revenue
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
        }
      }
      productMap[item.productId].qty += item.qty
      productMap[item.productId].grossRevenue += item.subtotal
      productMap[item.productId].revenue += item.subtotal * payRatio
    }
  }

  // Get weighted average cost per product from PurchaseItems within the period
  // Giá bình quân gia quyền = Σ(qty × unitCost) / Σqty
  const productIds = Object.keys(productMap)
  const costs: Record<string, number> = {}
  const costMethods: Record<string, string> = {}

  // Build purchase date filter for items within the report period
  const purchaseDateFilter: any = { purchase: { status: 'received' } }
  if (from || to) {
    purchaseDateFilter.purchase.purchaseDate = {}
    if (from) purchaseDateFilter.purchase.purchaseDate.gte = new Date(from)
    if (to) purchaseDateFilter.purchase.purchaseDate.lte = new Date(to + 'T23:59:59.999')
  }

  for (const pid of productIds) {
    // Lấy tất cả lần nhập trong kỳ báo cáo
    const inPeriod = await prisma.purchaseItem.findMany({
      where: { productId: pid, ...purchaseDateFilter },
      select: { qty: true, unitCost: true },
    })

    if (inPeriod.length > 0) {
      const totalQty = inPeriod.reduce((s, i) => s + i.qty, 0)
      const totalCostVal = inPeriod.reduce((s, i) => s + i.qty * i.unitCost, 0)
      costs[pid] = totalQty > 0 ? totalCostVal / totalQty : 0
      costMethods[pid] = 'avg_period'
    } else {
      // Fallback: giá bình quân toàn bộ lịch sử nhập hàng
      const allTime = await prisma.purchaseItem.findMany({
        where: { productId: pid, purchase: { status: 'received' } },
        select: { qty: true, unitCost: true },
      })
      if (allTime.length > 0) {
        const totalQty = allTime.reduce((s, i) => s + i.qty, 0)
        const totalCostVal = allTime.reduce((s, i) => s + i.qty * i.unitCost, 0)
        costs[pid] = totalQty > 0 ? totalCostVal / totalQty : 0
        costMethods[pid] = 'avg_all'
      } else {
        costs[pid] = 0
        costMethods[pid] = 'none'
      }
    }
  }

  // Build profit data
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
      costMethod: costMethods[p.productId] ?? 'none', // 'avg_period' | 'avg_all' | 'none'
    }
  }).sort((a, b) => b.profit - a.profit)

  const totals = {
    qty: profitData.reduce((s, p) => s + p.qty, 0),
    grossRevenue: profitData.reduce((s, p) => s + p.grossRevenue, 0),
    revenue: profitData.reduce((s, p) => s + p.revenue, 0),  // paid revenue
    totalCost: profitData.reduce((s, p) => s + p.totalCost, 0),
    profit: profitData.reduce((s, p) => s + p.profit, 0),
  }

  return NextResponse.json({ items: profitData, totals })
}
