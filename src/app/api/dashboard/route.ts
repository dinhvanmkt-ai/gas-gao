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
    lowStock,
    recentOrders,
    alertCustomers,
  ] = await Promise.all([
    // Today's orders
    prisma.order.count({
      where: { createdAt: { gte: today, lt: tomorrow }, status: { not: 'cancelled' } },
    }),
    // Month revenue
    prisma.order.aggregate({
      where: { createdAt: { gte: monthStart }, status: { in: ['completed', 'delivered'] } },
      _sum: { totalAmount: true },
    }),
    // Total customers
    prisma.customer.count(),
    // Urgent customers (score >= 75)
    prisma.customer.count({ where: { urgencyScore: { gte: 75 } } }),
    // Total debt
    prisma.customer.aggregate({ _sum: { debtBalance: true } }),
    // Low stock products
    prisma.product.findMany({
      where: { stock: { lte: prisma.product.fields.minStock } },
    }).catch(() => []),
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

  return NextResponse.json({
    todayOrders,
    monthRevenue: monthRevenue._sum.totalAmount ?? 0,
    totalCustomers,
    urgentCustomers,
    totalDebt: totalDebt._sum.debtBalance ?? 0,
    lowStockCount: 0, // simplified
    recentOrders,
    alertCustomers,
  })
}
