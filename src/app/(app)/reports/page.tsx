'use client'

import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { BarChart3, TrendingUp, Users, CreditCard, Package, Loader2, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import DateInput from '@/components/DateInput'

const TABS = ['Doanh Thu', 'Lợi Nhuận', 'Công Nợ', 'Khách Hàng', 'Kho Hàng']
const PIE_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6']

function getDateRange(preset: string): { from: Date; to: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(today)
  to.setHours(23, 59, 59, 999)

  switch (preset) {
    case 'today': return { from: today, to }
    case '7days': {
      const from = new Date(today)
      from.setDate(from.getDate() - 6)
      return { from, to }
    }
    case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      return { from, to: end }
    }
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3
      return { from: new Date(now.getFullYear(), qMonth, 1), to }
    }
    default: return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
  }
}

function formatVNDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

export default function ReportsPage() {
  const [tab, setTab] = useState(0)
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [profitData, setProfitData] = useState<{ items: any[]; totals: any } | null>(null)
  const [profitLoading, setProfitLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  // Date range
  const [preset, setPreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const dateRange = useMemo(() => {
    if (preset === 'custom') {
      const now = new Date()
      const from = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1)
      const to = customTo ? new Date(customTo + 'T23:59:59.999') : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { from, to }
    }
    return getDateRange(preset)
  }, [preset, customFrom, customTo])

  const handleSelectPreset = (key: string) => {
    setPreset(key)
    if (key === 'custom') {
      const current = getDateRange('month')
      if (!customFrom) setCustomFrom(toInputDate(current.from))
      if (!customTo) setCustomTo(toInputDate(current.to))
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
    ]).then(([c, p]) => {
      setCustomers(Array.isArray(c) ? c : [])
      setProducts(Array.isArray(p) ? p : [])
      setLoading(false)
    })
  }, [])

  // Fetch orders khi dateRange thay đổi — dùng toInputDate để tránh lệch múi giờ UTC+7
  useEffect(() => {
    const params = new URLSearchParams({
      from: toInputDate(dateRange.from),
      to: toInputDate(dateRange.to),
    })
    fetch(`/api/reports/orders?${params}`)
      .then(r => r.json())
      .then(o => setOrders(Array.isArray(o) ? o : []))
  }, [dateRange])

  // Load profit when tab=1 or date range changes — dùng toInputDate
  useEffect(() => {
    if (tab !== 1) return
    setProfitLoading(true)
    const params = new URLSearchParams({
      from: toInputDate(dateRange.from),
      to: toInputDate(dateRange.to),
    })
    fetch(`/api/reports/profit?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProfitData(d) })
      .finally(() => setProfitLoading(false))
  }, [tab, dateRange])

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const d = new Date(o.createdAt)
      return d >= dateRange.from && d <= dateRange.to
    })
  }, [orders, dateRange])

  // Compute stats from filtered orders
  const deliveredOrders = filteredOrders.filter(o => o.status === 'completed' || o.status === 'delivered')
  // Doanh thu thực thu = paidAmount, Doanh số bán hàng = totalAmount
  const totalRevenue = deliveredOrders.reduce((s, o) => s + (o.paidAmount ?? 0), 0)
  const totalInvoiced = deliveredOrders.reduce((s, o) => s + o.totalAmount, 0)
  const totalDebtPeriod = deliveredOrders.reduce((s, o) => s + (o.debtAmount ?? 0), 0)
  const totalDebt = customers.reduce((s, c) => s + c.debtBalance, 0)
  const debtCustomers = customers.filter(c => c.debtBalance > 0)

  // Revenue by payment method — use paidAmount
  const revenueByMethod = [
    { name: 'Tiền mặt', value: deliveredOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + (o.paidAmount ?? 0), 0) },
    { name: 'Chuyển khoản', value: deliveredOrders.filter(o => o.paymentMethod === 'transfer').reduce((s, o) => s + (o.paidAmount ?? 0), 0) },
    { name: 'Công nợ (đã thu)', value: deliveredOrders.filter(o => o.paymentMethod === 'debt').reduce((s, o) => s + (o.paidAmount ?? 0), 0) },
  ].filter(d => d.value > 0)

  // Stock by type
  const stockData = [
    { name: 'Gas', value: products.filter(p => p.type === 'gas').reduce((s, p) => s + p.stock, 0) },
    { name: 'Gạo (kg)', value: products.filter(p => p.type === 'rice').reduce((s, p) => s + p.stock, 0) },
  ]

  const PRESETS = [
    { key: 'today', label: 'Hôm nay' },
    { key: '7days', label: '7 ngày' },
    { key: 'month', label: 'Tháng này' },
    { key: 'lastMonth', label: 'Tháng trước' },
    { key: 'quarter', label: 'Quý này' },
    { key: 'custom', label: 'Tùy chọn' },
  ]

  return (
    <div className="flex flex-col flex-1">
      <Header title="Báo Cáo" subtitle="Phân tích doanh thu, công nợ, khách hàng" />
      <main className="flex-1 p-6 space-y-5">
        {/* Date Range Picker */}
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Khoảng thời gian:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => handleSelectPreset(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    preset === p.key
                      ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-orange-500/50 hover:text-slate-200'
                  }`}
                >{p.label}</button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <DateInput
                  value={customFrom}
                  onChange={setCustomFrom}
                  className="input py-1 text-xs w-36"
                />
                <span className="text-slate-500">→</span>
                <DateInput
                  value={customTo}
                  onChange={setCustomTo}
                  className="input py-1 text-xs w-36"
                />
              </div>
            )}
            {preset !== 'custom' && (
              <span className="text-xs text-slate-500">
                {formatVNDate(dateRange.from)} — {formatVNDate(dateRange.to)}
              </span>
            )}
          </div>
        </div>

        {/* Overall KPI */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="card p-5 kpi-green">
            <p className="text-xs text-slate-500 mb-0.5">Doanh số bán hàng</p>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalInvoiced)}</p>
            <p className="text-xs text-slate-400 mt-1">
              Thực thu: <span className="text-slate-300 font-medium">{formatCurrency(totalRevenue)}</span>
              {totalDebtPeriod > 0 && <span className="text-red-400 ml-1.5 font-medium">(Nợ mới: {formatCurrency(totalDebtPeriod)})</span>}
            </p>
          </div>
          <div className="card p-5 kpi-red">
            <p className="text-xs text-slate-500 mb-1">Tổng công nợ hiện tại</p>
            <p className="text-xl font-bold text-red-400">{formatCurrency(totalDebt)}</p>
          </div>
          <div className="card p-5 kpi-blue">
            <p className="text-xs text-slate-500 mb-1">Khách hàng có nợ</p>
            <p className="text-xl font-bold text-blue-400">{debtCustomers.length}</p>
          </div>
          <div className="card p-5 kpi-orange">
            <p className="text-xs text-slate-500 mb-1">Đơn hàng (lọc)</p>
            <p className="text-xl font-bold text-orange-400">{filteredOrders.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === i ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >{t}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
        ) : (
          <>
            {tab === 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-200 mb-4">Phương thức thanh toán (tiền đã thu)</h3>
                  {revenueByMethod.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={revenueByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                          {revenueByMethod.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-slate-500 text-center py-8">Chưa có dữ liệu</p>}
                </div>
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-200 mb-4">Top đơn hàng lớn nhất</h3>
                  <div className="space-y-3">
                    {deliveredOrders.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5).map(o => (
                      <div key={o.id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{o.customer?.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{o.orderNo}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-emerald-400">{formatCurrency(o.paidAmount ?? 0)}</p>
                          {(o.debtAmount ?? 0) > 0 && <p className="text-xs text-red-400">Nợ: {formatCurrency(o.debtAmount)}</p>}
                        </div>
                      </div>
                    ))}
                    {deliveredOrders.length === 0 && <p className="text-slate-500 text-center py-4">Chưa có đơn hàng</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === 1 && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-200 mb-1">Lợi nhuận gộp theo sản phẩm</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Doanh số = Tổng tiền đơn xuất bán · Giá vốn = Snapshot giá nhập tại thời điểm bán · Lợi nhuận gộp = Doanh số - Giá vốn
                </p>
                {profitLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
                ) : !profitData ? (
                  <p className="text-slate-500 text-center py-8">Chưa có dữ liệu</p>
                ) : (
                  <>
                    {/* Profit KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                        <p className="text-xs text-slate-500">Doanh số bán hàng</p>
                        <p className="text-base font-bold text-emerald-400">{formatCurrency(profitData.totals.grossRevenue)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Đã thu: {formatCurrency(profitData.totals.paidRevenue || 0)}
                        </p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                        <p className="text-xs text-slate-500">Chi phí vốn (COGS)</p>
                        <p className="text-base font-bold text-blue-400">{formatCurrency(profitData.totals.totalCost)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {profitData.totals.qty} sản phẩm xuất bán
                        </p>
                      </div>
                      <div className={`${profitData.totals.profit >= 0 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20'} border rounded-xl p-3`}>
                        <p className="text-xs text-slate-500">Lợi nhuận gộp</p>
                        <p className={`text-base font-bold ${profitData.totals.profit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                          {formatCurrency(profitData.totals.profit)}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Biên lãi gộp: {profitData.totals.grossRevenue > 0 ? ((profitData.totals.profit / profitData.totals.grossRevenue) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                        <p className="text-xs text-slate-500">Dòng tiền & Công nợ kỳ này</p>
                        <p className="text-base font-bold text-purple-400">
                          {formatCurrency(profitData.totals.paidRevenue || 0)}
                        </p>
                        <p className="text-[11px] text-red-400 mt-0.5">
                          Nợ phát sinh: {formatCurrency(profitData.totals.debtRevenue || 0)}
                        </p>
                      </div>
                    </div>
                    {/* Profit table */}
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr>
                          <th>Sản phẩm</th>
                          <th>SL bán</th>
                          <th>Giá vốn TB</th>
                          <th>Doanh số</th>
                          <th>Chi phí vốn</th>
                          <th>Lợi nhuận gộp</th>
                          <th>Biên lãi</th>
                          <th>Thực thu / Nợ</th>
                        </tr></thead>
                        <tbody>
                          {profitData.items.map((p: any) => (
                            <tr key={p.productId}>
                              <td className="font-medium">{p.name} <span className="text-xs text-slate-500">({p.type === 'gas' ? 'Gas' : p.type === 'rice' ? 'Gạo' : 'Khác'})</span></td>
                              <td>{p.qty} {p.unit}</td>
                              <td>
                                {p.unitCost > 0 ? (
                                  <span className="flex items-center gap-1.5">
                                    {formatCurrency(p.unitCost)}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                      p.costMethod === 'manual'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : p.costMethod === 'avg_period'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {p.costMethod === 'manual' ? 'nhập tay' : p.costMethod === 'avg_period' ? 'bq kỳ' : 'bq TL'}
                                    </span>
                                  </span>
                                ) : <span className="text-slate-500">Chưa có giá</span>}
                              </td>
                              <td className="text-emerald-400 font-medium">{formatCurrency(p.grossRevenue)}</td>
                              <td className="text-blue-400">{formatCurrency(p.totalCost)}</td>
                              <td className={p.profit >= 0 ? 'text-orange-400 font-semibold' : 'text-red-400 font-semibold'}>{formatCurrency(p.profit)}</td>
                              <td>
                                <span className={`text-xs font-medium ${p.margin >= 20 ? 'text-emerald-400' : p.margin >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                  {p.margin.toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-xs">
                                <span className="text-slate-300">{formatCurrency(p.paidRevenue || 0)}</span>
                                {(p.debtRevenue || 0) > 0 && (
                                  <span className="text-red-400 block text-[11px]">Nợ: {formatCurrency(p.debtRevenue)}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-800/60 font-bold">
                            <td>Tổng</td>
                            <td>{profitData.totals.qty}</td>
                            <td>—</td>
                            <td className="text-emerald-400">{formatCurrency(profitData.totals.grossRevenue)}</td>
                            <td className="text-blue-400">{formatCurrency(profitData.totals.totalCost)}</td>
                            <td className={profitData.totals.profit >= 0 ? 'text-orange-400' : 'text-red-400'}>{formatCurrency(profitData.totals.profit)}</td>
                            <td>
                              {profitData.totals.grossRevenue > 0
                                ? `${((profitData.totals.profit / profitData.totals.grossRevenue) * 100).toFixed(1)}%`
                                : '—'}
                            </td>
                            <td className="text-xs">
                              <span className="text-slate-300">{formatCurrency(profitData.totals.paidRevenue || 0)}</span>
                              {(profitData.totals.debtRevenue || 0) > 0 && (
                                <span className="text-red-400 block text-[11px]">Nợ: {formatCurrency(profitData.totals.debtRevenue)}</span>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 2 && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-200 mb-4">Danh sách công nợ</h3>
                {debtCustomers.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Không có công nợ 🎉</p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Khách hàng</th><th>SĐT</th><th>Nợ hiện tại</th></tr></thead>
                      <tbody>
                        {debtCustomers.sort((a, b) => b.debtBalance - a.debtBalance).map(c => (
                          <tr key={c.id}>
                            <td className="font-medium">{c.name}</td>
                            <td>{c.phone}</td>
                            <td className="font-semibold text-red-400">{formatCurrency(c.debtBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-800/50">
                          <td colSpan={2} className="font-semibold text-slate-300">Tổng cộng</td>
                          <td className="font-bold text-red-400">{formatCurrency(totalDebt)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 3 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-200 mb-4">Phân loại khách hàng</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Khẩn cấp (≥80)', count: customers.filter(c => c.urgencyScore >= 80).length, cls: 'bg-red-500' },
                      { label: 'Sắp mua (50-79)', count: customers.filter(c => c.urgencyScore >= 50 && c.urgencyScore < 80).length, cls: 'bg-yellow-500' },
                      { label: 'Bình thường (25-49)', count: customers.filter(c => c.urgencyScore >= 25 && c.urgencyScore < 50).length, cls: 'bg-blue-500' },
                      { label: 'Còn lâu (<25)', count: customers.filter(c => c.urgencyScore < 25).length, cls: 'bg-emerald-500' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${item.cls}`} />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm"><span>{item.label}</span><span className="font-semibold">{item.count}</span></div>
                          <div className="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${item.cls} rounded-full`} style={{ width: `${customers.length > 0 ? (item.count / customers.length) * 100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-200 mb-4">Thống kê khách hàng</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-slate-800"><span className="text-slate-400">Tổng khách hàng</span><span className="font-semibold">{customers.length}</span></div>
                    <div className="flex justify-between py-2 border-b border-slate-800"><span className="text-slate-400">Có dự đoán Gas</span><span className="font-semibold">{customers.filter(c => c.gasPredictedDate).length}</span></div>
                    <div className="flex justify-between py-2 border-b border-slate-800"><span className="text-slate-400">Có dự đoán Gạo</span><span className="font-semibold">{customers.filter(c => c.ricePredictedDate).length}</span></div>
                    <div className="flex justify-between py-2 border-b border-slate-800"><span className="text-slate-400">Đang giữ bình gas</span><span className="font-semibold">{customers.filter(c => c.gasCylinderQty > 0).length}</span></div>
                    <div className="flex justify-between py-2"><span className="text-slate-400">Có công nợ</span><span className="font-semibold text-red-400">{debtCustomers.length}</span></div>
                  </div>
                </div>
              </div>
            )}

            {tab === 4 && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-200 mb-4">Tồn kho hiện tại</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={products} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" />
                    <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} />
                    <Bar dataKey="stock" name="Tồn kho" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="minStock" name="Tối thiểu" fill="#334155" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
