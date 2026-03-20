'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import {
  ShoppingCart, Users, TrendingUp, AlertTriangle,
  CreditCard, Package, Clock, Phone, ArrowRight, Loader2
} from 'lucide-react'
import { formatCurrency, formatDate, urgencyColor, urgencyLabel } from '@/lib/utils'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'

// Fake time series for chart demo
const revenueData = [
  { day: '10/3', gas: 2400000, rice: 800000 },
  { day: '11/3', gas: 1800000, rice: 1200000 },
  { day: '12/3', gas: 3200000, rice: 600000 },
  { day: '13/3', gas: 2900000, rice: 1400000 },
  { day: '14/3', gas: 3800000, rice: 900000 },
  { day: '15/3', gas: 4200000, rice: 1100000 },
  { day: '16/3', gas: 3600000, rice: 1300000 },
]

interface DashboardData {
  todayOrders: number
  monthRevenue: number
  totalCustomers: number
  urgentCustomers: number
  totalDebt: number
  lowStockCount: number
  recentOrders: any[]
  alertCustomers: any[]
}

function KpiCard({ label, value, icon: Icon, colorClass, sub }: {
  label: string; value: string; icon: any; colorClass: string; sub?: string
}) {
  return (
    <div className={`card border p-5 ${colorClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-slate-800/60">
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Dashboard" subtitle="Tổng quan hoạt động" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    )
  }

  const kpis = [
    {
      label: 'Đơn hôm nay',
      value: String(data?.todayOrders ?? 0),
      icon: ShoppingCart,
      colorClass: 'kpi-orange',
      sub: 'đơn hàng',
    },
    {
      label: 'Doanh thu tháng',
      value: formatCurrency(data?.monthRevenue ?? 0),
      icon: TrendingUp,
      colorClass: 'kpi-green',
      sub: 'tháng này',
    },
    {
      label: 'Khách hàng',
      value: String(data?.totalCustomers ?? 0),
      icon: Users,
      colorClass: 'kpi-blue',
      sub: `${data?.urgentCustomers ?? 0} cần chú ý`,
    },
    {
      label: 'Công nợ',
      value: formatCurrency(data?.totalDebt ?? 0),
      icon: CreditCard,
      colorClass: 'kpi-red',
      sub: 'tổng dư nợ',
    },
  ]

  return (
    <div className="flex flex-col flex-1">
      <Header title="Dashboard" subtitle="Tổng quan hoạt động hôm nay" />

      <main className="flex-1 p-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>

        {/* Charts + Alert customers */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Revenue chart */}
          <div className="xl:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-200">Doanh thu 7 ngày qua</h3>
                <p className="text-xs text-slate-500 mt-0.5">Gas + Gạo</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="riceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#475569" tick={{ fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000000}M`} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v: any) => formatCurrency(Number(v))}
                />
                <Area type="monotone" dataKey="gas" name="Gas" stroke="#f97316" fill="url(#gasGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="rice" name="Gạo" stroke="#3b82f6" fill="url(#riceGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Alert customers */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <h3 className="font-semibold text-slate-200">Cần liên hệ</h3>
              </div>
              <Link href="/customers" className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
                Xem tất cả <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {(data?.alertCustomers ?? []).length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Không có khách hàng nào cần chú ý</p>
              ) : (
                (data?.alertCustomers ?? []).map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/40 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-300 flex-shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{c.phone}
                      </p>
                    </div>
                    <span className={urgencyColor(c.urgencyScore)}>
                      {urgencyLabel(c.urgencyScore)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-slate-200">Đơn hàng gần đây</h3>
            </div>
            <Link href="/orders" className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {(data?.recentOrders ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Chưa có đơn hàng nào</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Tổng tiền</th>
                    <th>Thanh toán</th>
                    <th>Trạng thái</th>
                    <th>Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentOrders ?? []).map((o: any) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/orders/${o.id}`} className="text-orange-400 hover:text-orange-300 font-mono text-xs">
                          {o.orderNo}
                        </Link>
                      </td>
                      <td className="font-medium">{o.customer?.name}</td>
                      <td>{formatCurrency(o.totalAmount)}</td>
                      <td>
                        <span className="text-xs capitalize">{o.paymentMethod === 'cash' ? 'Tiền mặt' : o.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Công nợ'}</span>
                      </td>
                      <td>
                        {(o.status === 'completed' || o.status === 'delivered') && <span className="badge-green">Hoàn tất</span>}
                        {o.status === 'pending' && <span className="badge-yellow">Chờ xử lý</span>}
                      </td>
                      <td className="text-slate-500 text-xs">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
