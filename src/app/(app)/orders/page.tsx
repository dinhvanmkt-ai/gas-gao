'use client'

import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { Search, Plus, ShoppingCart, Loader2, Download, Calendar } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
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

function getTimeRange(key: string): { from: Date; to: Date } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(today)
  to.setHours(23, 59, 59, 999)
  switch (key) {
    case 'today': return { from: today, to }
    case 'week': {
      const from = new Date(today)
      from.setDate(from.getDate() - from.getDay() + 1) // Monday
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
  const [timeFilter, setTimeFilter] = useState('')
  const [payFilter, setPayFilter] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/orders?q=${encodeURIComponent(q)}&status=${status}`)
    const data = await res.json()
    setOrders(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [q, status])

  // Client-side filtering for time & payment
  const filteredOrders = useMemo(() => {
    let result = orders

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
      const from = new Date(customFrom)
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
  }, [orders, timeFilter, payFilter, customFrom, customTo])

  const totalRevenue = filteredOrders.filter(o => o.status === 'completed' || o.status === 'delivered').reduce((s, o) => s + o.totalAmount, 0)

  // Export Excel (CSV with BOM for Vietnamese)
  function exportExcel() {
    const BOM = '\ufeff'
    const headers = ['Mã đơn', 'Khách hàng', 'SĐT', 'Sản phẩm', 'Tổng tiền', 'Đã trả', 'Còn nợ', 'Thanh toán', 'Trạng thái', 'Ngày tạo']
    const rows = filteredOrders.map(o => [
      o.orderNo,
      o.customer?.name ?? '',
      o.customer?.phone ?? '',
      (o.items ?? []).map((i: any) => `${i.qty} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join('; '),
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
    a.download = `don-hang-${new Date().toISOString().slice(0, 10)}.csv`
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
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
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
                onClick={() => setTimeFilter(f.key)}
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

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Tổng đơn</p><p className="text-xl font-bold">{filteredOrders.length}</p></div>
          <div className="card p-4 kpi-yellow"><p className="text-xs text-slate-500 mb-1">Chờ xử lý</p><p className="text-xl font-bold text-yellow-400">{filteredOrders.filter(o => o.status === 'pending').length}</p></div>
          <div className="card p-4 kpi-green"><p className="text-xs text-slate-500 mb-1">Hoàn tất</p><p className="text-xl font-bold text-emerald-400">{filteredOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length}</p></div>
          <div className="card p-4 kpi-orange"><p className="text-xs text-slate-500 mb-1">Doanh thu</p><p className="text-lg font-bold text-orange-400">{formatCurrency(totalRevenue)}</p></div>
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
                      <td><div className="text-xs text-slate-400">{o.items?.map((i: any) => `${i.qty} ${i.product?.unit} ${i.product?.name}`).join(', ')}</div></td>
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
