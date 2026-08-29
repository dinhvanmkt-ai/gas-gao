'use client'

import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { Search, Plus, ShoppingCart, Loader2, Download, Calendar } from 'lucide-react'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/utils'
import Link from 'next/link'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Chờ xử lý', cls: 'badge-yellow' },
  completed: { label: 'Hoàn tất',  cls: 'badge-green' },
  delivered: { label: 'Hoàn tất',  cls: 'badge-green' }, // legacy fallback
}

const PAY_MAP: Record<string, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  debt: 'Công nợ',
}

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

function getTimeRange(key: string): { from: Date; to: Date } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(today)
  to.setHours(23, 59, 59, 999)
  switch (key) {
    case 'today': return { from: today, to }
    case 'week': {
      const from = new Date(today)
      const day = from.getDay()
      const diff = from.getDate() - day + (day === 0 ? -6 : 1) // Monday
      from.setDate(diff)
      return { from, to }
    }
    case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
    default: return null
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [productType, setProductType] = useState('')
  const [timeFilter, setTimeFilter] = useState('today')
  const [payFilter, setPayFilter] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const handleSelectTimeFilter = (key: string) => {
    setTimeFilter(key)
    if (key === 'custom') {
      const todayStr = toInputDate(new Date())
      if (!customFrom) setCustomFrom(todayStr)
      if (!customTo) setCustomTo(todayStr)
    }
  }

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/orders?q=${encodeURIComponent(q)}&status=${status}&productType=${productType}`)
    const data = await res.json()
    setOrders(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [q, status, productType])

  // Client-side filtering for time, payment & product type
  const filteredOrders = useMemo(() => {
    let result = orders

    // Product type filter
    if (productType === 'gas') {
      result = result.filter(o => o.items?.some((i: any) => i.product?.type === 'gas'))
    } else if (productType === 'rice') {
      result = result.filter(o => o.items?.some((i: any) => i.product?.type === 'rice'))
    } else if (productType === 'other') {
      result = result.filter(o => o.items?.some((i: any) => i.product?.type !== 'gas' && i.product?.type !== 'rice'))
    }

    // Time filter
    if (timeFilter && timeFilter !== 'custom') {
      const range = getTimeRange(timeFilter)
      if (range) {
        result = result.filter(o => {
          const d = new Date(o.createdAt)
          return d >= range.from && d <= range.to
        })
      }
    } else if (timeFilter === 'custom' && customFrom && customTo) {
      const from = new Date(customFrom + 'T00:00:00')
      const to = new Date(customTo + 'T23:59:59.999')
      result = result.filter(o => {
        const d = new Date(o.createdAt)
        return d >= from && d <= to
      })
    }

    // Payment filter
    if (payFilter === 'paid') {
      result = result.filter(o => o.debtAmount <= 0)
    } else if (payFilter === 'debt') {
      result = result.filter(o => o.debtAmount > 0)
    }

    return result
  }, [orders, productType, timeFilter, payFilter, customFrom, customTo])

  const totalRevenue = filteredOrders.filter(o => o.status === 'completed' || o.status === 'delivered').reduce((s, o) => s + o.totalAmount, 0)

  // Export Excel (CSV with BOM for Vietnamese)
  function exportExcel() {
    const BOM = '\ufeff'
    const headers = ['Mã đơn', 'Khách hàng', 'SĐT', 'Sản phẩm', 'Tổng tiền', 'Đã trả', 'Còn nợ', 'Thanh toán', 'Trạng thái', 'Ngày tạo']
    const rows = filteredOrders.map(o => [
      o.orderNo,
      o.customer?.name ?? '',
      o.customer?.phone ?? '',
      (o.items ?? []).map((i: any) => `[${i.product?.type === 'gas' ? 'Gas' : i.product?.type === 'rice' ? 'Gạo' : 'Khác'}] ${i.qty} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join('; '),
      o.totalAmount,
      o.paidAmount,
      o.debtAmount,
      PAY_MAP[o.paymentMethod] ?? o.paymentMethod,
      STATUS_MAP[o.status]?.label ?? o.status,
      formatDate(o.createdAt),
    ])
    const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `don-hang-${getLocalDateString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Đơn Hàng" subtitle="Quản lý và theo dõi đơn hàng" />

      <main className="flex-1 p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Tìm mã đơn, khách hàng..." value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
                <option value="">Tất cả TT</option>
                <option value="pending">Chờ xử lý</option>
                <option value="completed">Hoàn tất</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportExcel} className="btn-secondary text-sm">
                <Download className="w-4 h-4" /> Xuất Excel
              </button>
              <Link href="/orders/new" className="btn-primary">
                <Plus className="w-4 h-4" />
                Tạo đơn hàng
              </Link>
            </div>
          </div>

          {/* Extra filters row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Product Type Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
              {[
                { key: '', label: 'Tất cả nhóm' },
                { key: 'gas', label: '🔥 Gas' },
                { key: 'rice', label: '🌾 Gạo' },
                { key: 'other', label: '📦 Khác' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setProductType(t.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    productType === t.key
                      ? 'bg-orange-500 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Time and Payment Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              {[
                { key: '', label: 'Tất cả' },
                { key: 'today', label: 'Hôm nay' },
                { key: 'week', label: 'Tuần này' },
                { key: 'month', label: 'Tháng này' },
                { key: 'custom', label: 'Tùy chọn' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => handleSelectTimeFilter(f.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                    timeFilter === f.key
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-orange-500/50'
                  }`}
                >{f.label}</button>
              ))}
              {timeFilter === 'custom' && (
                <>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input py-1 text-xs w-auto" />
                  <span className="text-slate-500 text-xs">→</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input py-1 text-xs w-auto" />
                </>
              )}

              <span className="text-slate-700 mx-1">|</span>

              <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} className="input w-auto py-1 text-xs">
                <option value="">Tất cả thanh toán</option>
                <option value="paid">Đã thanh toán</option>
                <option value="debt">Còn nợ</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Tổng đơn</p><p className="text-xl font-bold">{filteredOrders.length}</p></div>
          <div className="card p-4 kpi-yellow"><p className="text-xs text-slate-500 mb-1">Chờ xử lý</p><p className="text-xl font-bold text-yellow-400">{filteredOrders.filter(o => o.status === 'pending').length}</p></div>
          <div className="card p-4 kpi-green"><p className="text-xs text-slate-500 mb-1">Hoàn tất</p><p className="text-xl font-bold text-emerald-400">{filteredOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length}</p></div>
          <div className="card p-4 kpi-orange"><p className="text-xs text-slate-500 mb-1">Doanh số</p><p className="text-lg font-bold text-orange-400">{formatCurrency(totalRevenue)}</p></div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
              <p>Không có đơn hàng nào</p>
            </div>
          ) : (
            <table className="table">
              <thead><tr>
                <th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th>Ngày tạo</th><th></th>
              </tr></thead>
              <tbody>
                {filteredOrders.map((o) => {
                  const s = STATUS_MAP[o.status] ?? { label: o.status, cls: 'badge-gray' }
                  return (
                    <tr key={o.id}>
                      <td><span className="font-mono text-xs text-orange-400">{o.orderNo}</span></td>
                      <td><div><p className="font-medium">{o.customer?.name}</p><p className="text-xs text-slate-500">{o.customer?.phone}</p></div></td>
                      <td>
                        <div className="flex flex-col gap-1 text-xs">
                          {o.items?.map((i: any, idx: number) => {
                            const type = i.product?.type
                            return (
                              <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  type === 'gas'
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                    : type === 'rice'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-slate-700 text-slate-300'
                                }`}>
                                  {type === 'gas' ? 'Gas' : type === 'rice' ? 'Gạo' : 'Khác'}
                                </span>
                                <span>{i.qty} {i.product?.unit} {i.product?.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                      <td><p className="font-medium">{formatCurrency(o.totalAmount)}</p>{o.debtAmount > 0 && <p className="text-xs text-red-400">Nợ: {formatCurrency(o.debtAmount)}</p>}</td>
                      <td><span className="text-xs">{PAY_MAP[o.paymentMethod] ?? o.paymentMethod}</span></td>
                      <td><span className={s.cls}>{s.label}</span></td>
                      <td className="text-slate-500 text-xs">{formatDate(o.createdAt)}</td>
                      <td><Link href={`/orders/${o.id}`} className="btn-ghost text-xs">Chi tiết →</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
