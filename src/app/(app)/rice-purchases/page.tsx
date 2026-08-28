'use client'
import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Loader2, Wheat, Calendar, X, Pencil, CheckCircle, AlertTriangle } from 'lucide-react'

interface RicePurchase {
  id: string
  purchaseNo: string
  purchaseDate: string
  supplier: { name: string } | null
  paymentStatus: string
  totalCost: number
  note: string | null
  items: {
    id: string
    totalKg: number
    pricePerKg: number
    subtotal: number
    riceProduct: { id: string; name: string }
  }[]
}

function formatDate(d: string) {
  const dt = new Date(d)
  return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`
}

export default function RicePurchasesPage() {
  const [records, setRecords] = useState<RicePurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandId, setExpandId] = useState<string | null>(null)

  // Date filter
  const [preset, setPreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  function getRange() {
    const now = new Date()
    if (preset === 'month') return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    }
    if (preset === 'lastMonth') {
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0],
        to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0],
      }
    }
    if (preset === '3months') return {
      from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0],
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    }
    if (preset === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo }
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    }
  }

  async function load() {
    setLoading(true)
    const range = getRange()
    const params = new URLSearchParams({ from: range.from, to: range.to })
    const res = await fetch(`/api/rice-purchases?${params}`)
    const data = await res.json()
    setRecords(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [preset, customFrom, customTo])

  const totalKg = useMemo(() =>
    records.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.totalKg, 0), 0), [records])
  const totalCost = useMemo(() => records.reduce((s, r) => s + r.totalCost, 0), [records])
  const avgPrice = totalKg > 0 ? totalCost / totalKg : 0
  const oweCount = useMemo(() => records.filter(r => r.paymentStatus === 'owe').length, [records])

  async function handleDelete(id: string) {
    setDeleting(true)
    const res = await fetch(`/api/rice-purchases/${id}`, { method: 'DELETE' })
    if (res.ok) { setDeleteId(null); await load() }
    setDeleting(false)
  }

  async function markPaid(id: string) {
    await fetch(`/api/rice-purchases/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'paid' }),
    })
    await load()
  }

  const PRESETS = [
    { key: 'month', label: 'Tháng này' },
    { key: 'lastMonth', label: 'Tháng trước' },
    { key: '3months', label: '3 tháng' },
    { key: 'custom', label: 'Tùy chọn' },
  ]

  return (
    <div className="flex flex-col flex-1">
      <Header title="Nhập Gạo" subtitle="Quản lý phiếu nhập gạo theo lô" />
      <main className="flex-1 p-6 space-y-5">

        {/* Date filter */}
        <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="w-4 h-4" /><span className="font-medium">Kỳ:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${preset === p.key ? 'bg-green-500 text-white border-green-500' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-green-500/50'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input py-1 text-xs w-auto" />
              <span className="text-slate-500">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input py-1 text-xs w-auto" />
            </div>
          )}
          <div className="ml-auto">
            <Link href="/rice-purchases/new" className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
              <Plus className="w-4 h-4" /> Phiếu nhập mới
            </Link>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 kpi-green">
            <p className="text-xs text-slate-500 mb-1">Tổng kg nhập</p>
            <p className="text-2xl font-bold text-emerald-400">{totalKg.toLocaleString('vi-VN')} kg</p>
            <p className="text-xs text-slate-500 mt-0.5">{records.length} phiếu</p>
          </div>
          <div className="card p-4 kpi-blue">
            <p className="text-xs text-slate-500 mb-1">Tổng tiền nhập</p>
            <p className="text-xl font-bold text-blue-400">{formatCurrency(totalCost)}</p>
          </div>
          <div className="card p-4 kpi-orange">
            <p className="text-xs text-slate-500 mb-1">Giá bình quân</p>
            <p className="text-xl font-bold text-orange-400">{formatCurrency(avgPrice)}<span className="text-xs font-normal text-slate-400">/kg</span></p>
          </div>
          <div className={`card p-4 ${oweCount > 0 ? 'kpi-red' : ''}`}>
            <p className="text-xs text-slate-500 mb-1">Đang nợ NCC</p>
            <p className={`text-2xl font-bold ${oweCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>{oweCount} phiếu</p>
          </div>
        </div>

        {/* Owe warning */}
        {oweCount > 0 && (
          <div className="card p-4 border-yellow-500/30 bg-yellow-500/5 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-200">
              Có <strong>{oweCount} phiếu</strong> chưa thanh toán cho NCC.
              Tổng nợ: <strong>{formatCurrency(records.filter(r => r.paymentStatus === 'owe').reduce((s, r) => s + r.totalCost, 0))}</strong>
            </p>
          </div>
        )}

        {/* List */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2 mb-4">
            <Wheat className="w-4 h-4 text-green-400" /> Danh sách phiếu nhập gạo
          </h3>

          {deleteId && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-200">Xóa phiếu này? Dữ liệu sẽ mất vĩnh viễn.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1 transition-colors">
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Xác nhận
                </button>
                <button onClick={() => setDeleteId(null)} className="btn-ghost text-xs">Hủy</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-green-500" /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Wheat className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Chưa có phiếu nhập nào trong kỳ này</p>
              <Link href="/rice-purchases/new" className="mt-3 text-green-400 hover:text-green-300 text-sm inline-block">+ Tạo phiếu nhập đầu tiên</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map(r => {
                const isExpanded = expandId === r.id
                const totalKgRow = r.items.reduce((s, i) => s + i.totalKg, 0)
                return (
                  <div key={r.id} className="border border-slate-700/50 rounded-xl overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center gap-4 p-4 hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => setExpandId(isExpanded ? null : r.id)}>
                      <div className="flex-shrink-0">
                        <span className="font-mono text-xs text-green-400">{r.purchaseNo}</span>
                      </div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">{formatDate(r.purchaseDate)}</div>
                      <div className="text-sm text-slate-300">{r.supplier?.name ?? <span className="text-slate-600">—</span>}</div>
                      <div className="text-xs text-slate-400 flex-1 truncate">
                        {r.items.map(i => `${i.riceProduct.name}: ${i.totalKg}kg`).join(' · ')}
                      </div>
                      <div className="text-sm font-semibold text-emerald-400 whitespace-nowrap">{totalKgRow.toLocaleString('vi-VN')} kg</div>
                      <div className="font-bold text-blue-400 whitespace-nowrap">{formatCurrency(r.totalCost)}</div>
                      <div>
                        {r.paymentStatus === 'paid'
                          ? <span className="badge-green text-xs">Đã trả</span>
                          : <span className="badge-yellow text-xs">Nợ NCC</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {r.paymentStatus === 'owe' && (
                          <button onClick={e => { e.stopPropagation(); markPaid(r.id) }}
                            className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors" title="Đánh dấu đã thanh toán">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); setDeleteId(r.id) }}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Expand: detail */}
                    {isExpanded && (
                      <div className="border-t border-slate-700/50 p-4 bg-slate-800/20">
                        <table className="table text-sm">
                          <thead><tr>
                            <th>Loại gạo</th><th>Số kg</th><th>Giá/kg</th><th>Thành tiền</th>
                          </tr></thead>
                          <tbody>
                            {r.items.map(item => (
                              <tr key={item.id}>
                                <td className="font-medium text-emerald-400">{item.riceProduct.name}</td>
                                <td>{item.totalKg.toLocaleString('vi-VN')} kg</td>
                                <td>{formatCurrency(item.pricePerKg)}/kg</td>
                                <td className="font-semibold text-blue-400">{formatCurrency(item.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {r.note && <p className="text-xs text-slate-400 italic mt-3">Ghi chú: {r.note}</p>}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Tổng kết */}
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl font-bold text-sm mt-2">
                <span className="text-slate-300">Tổng kỳ ({records.length} phiếu)</span>
                <div className="flex items-center gap-8">
                  <span className="text-emerald-400">{totalKg.toLocaleString('vi-VN')} kg</span>
                  <span className="text-blue-400">{formatCurrency(totalCost)}</span>
                  <span className="text-slate-400 text-xs">BQ: {formatCurrency(avgPrice)}/kg</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}