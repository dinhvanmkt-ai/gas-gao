export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [
    todayOrders,
    monthRevenue,
    totalCustomers,
    urgentCustomers,
    totalDebt,
    allProducts,
    recentOrders,
    alertCustomers,
  ] = await Promise.all([
    // Today's orders
    prisma.order.count({
      where: { createdAt: { gte: today, lt: tomorrow }, status: { not: 'cancelled' } },
    }),
    // Month revenue — tổng doanh số và thực thu
    prisma.order.aggregate({
      where: { createdAt: { gte: monthStart }, status: { in: ['completed', 'delivered'] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    // Total customers
    prisma.customer.count(),
    // Urgent customers (score >= 75)
    prisma.customer.count({ where: { urgencyScore: { gte: 75 } } }),
    // Total debt
    prisma.customer.aggregate({ _sum: { debtBalance: true } }),
    // All products — tính lowStock ở application layer (tránh lỗi Prisma cross-field compare)
    prisma.product.findMany({ select: { stock: true, minStock: true } }),
    // Recent orders
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
    // Alert customers (needing action soon)
    prisma.customer.findMany({
      where: { urgencyScore: { gte: 50 } },
      orderBy: { urgencyScore: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true,
        urgencyScore: true,
        gasPredictedDate: true,
        ricePredictedDate: true,
        debtBalance: true,
      },
    }),
  ])

  // ── Fix: tính lowStockCount ở application layer
  const lowStockCount = allProducts.filter(p => p.stock <= p.minStock).length

  // ── Doanh thu bán hàng 7 ngày qua theo Gas + Gạo
  const revenue7days: { day: string; gas: number; rice: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(today)
    dayStart.setDate(today.getDate() - i)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)
    const dayLabel = `${dayStart.getDate()}/${dayStart.getMonth() + 1}`

    const dayOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['completed', 'delivered'] },
      },
      include: { items: { include: { product: { select: { type: true } } } } },
    })

    let gasRevenue = 0
    let riceRevenue = 0
    for (const order of dayOrders) {
      const gasSubtotal = order.items
        .filter(it => it.product.type === 'gas')
        .reduce((s, it) => s + it.subtotal, 0)
      const riceSubtotal = order.items
        .filter(it => it.product.type === 'rice')
        .reduce((s, it) => s + it.subtotal, 0)
      gasRevenue += gasSubtotal
      riceRevenue += riceSubtotal
    }
    revenue7days.push({ day: dayLabel, gas: gasRevenue, rice: riceRevenue })
  }

  return NextResponse.json({
    todayOrders,
    monthRevenue: monthRevenue._sum.totalAmount ?? 0,
    monthPaid: monthRevenue._sum.paidAmount ?? 0,
    totalCustomers,
    urgentCustomers,
    totalDebt: totalDebt._sum.debtBalance ?? 0,
    lowStockCount,
    recentOrders,
    alertCustomers,
    revenue7days,
  })
}

