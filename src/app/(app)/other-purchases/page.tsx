'use client'

import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { ShoppingBag, Plus, Loader2, Trash2, AlertTriangle, Calendar, CheckCircle, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/utils'
import Link from 'next/link'
import DateInput from '@/components/DateInput'

const PRESETS = [
  { key: 'month', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
  { key: '3months', label: '3 tháng' },
  { key: 'custom', label: 'Tùy chọn' },
]

function getRange(preset: string, customFrom: string, customTo: string) {
  const now = new Date()
  if (preset === 'month') return {
    from: getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
  if (preset === 'lastMonth') return {
    from: getLocalDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 0)),
  }
  if (preset === '3months') return {
    from: getLocalDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
    to: getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
  if (preset === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo }
  return {
    from: getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

interface PurchaseItem {
  id: string
  qty: number
  unitCost: number
  subtotal: number
  product: {
    id: string
    name: string
    unit: string
    priceRetail: number
    costPrice: number | null
  }
}

interface Purchase {
  id: string
  purchaseNo: string
  purchaseDate: string
  supplier: { name: string } | null
  paymentStatus: string
  status: string
  totalAmount: number
  note: string | null
  items: PurchaseItem[]
}

export default function OtherPurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [expandId, setExpandId] = useState<string | null>(null)

  // Date filter
  const [preset, setPreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  async function load() {
    setLoading(true)
    const range = getRange(preset, customFrom, customTo)
    const params = new URLSearchParams({ from: range.from, to: range.to })
    const d = await fetch(`/api/other-purchases?${params}`).then(r => r.ok ? r.json() : []).catch(() => [])
    setPurchases(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [preset, customFrom, customTo])

  async function handleDelete(id: string) {
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/other-purchases/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleteId(null)
      setPurchases(prev => prev.filter(p => p.id !== id))
    } else {
      const err = await res.json()
      setDeleteError(err.error ?? 'Không thể xóa phiếu nhập')
    }
    setDeleting(false)
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/other-purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'paid' }),
    })
    if (res.ok) await load()
  }

  // KPI
  const totalAmount = useMemo(() => purchases.reduce((s, p) => s + p.totalAmount, 0), [purchases])
  const oweCount = useMemo(() => purchases.filter(p => p.paymentStatus === 'owe').length, [purchases])
  const oweTotalAmount = useMemo(() =>
    purchases.filter(p => p.paymentStatus === 'owe').reduce((s, p) => s + p.totalAmount, 0),
    [purchases]
  )

  // Tổng lợi nhuận ước tính (nếu bán hết)
  const totalProfit = useMemo(() =>
    purchases.reduce((s, p) =>
      s + p.items.reduce((ss, item) => {
        const costPrice = item.product.costPrice ?? item.unitCost
        const profit = (item.product.priceRetail - costPrice) * item.qty
        return ss + profit
      }, 0), 0),
    [purchases]
  )

  const delPurchase = purchases.find(p => p.id === deleteId)

  return (
    <div className="flex flex-col flex-1">
      <Header title="Nhập SP Khác" subtitle="Quản lý phiếu nhập sản phẩm khác (ngoài gas và gạo)" />
      <main className="flex-1 p-6 space-y-5">

        {/* Date Filter + New Button */}
        <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="w-4 h-4" /><span className="font-medium">Kỳ:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  preset === p.key
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-purple-500/50'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <DateInput value={customFrom} onChange={setCustomFrom} className="input py-1 text-xs w-36" />
              <span className="text-slate-500">→</span>
              <DateInput value={customTo} onChange={setCustomTo} className="input py-1 text-xs w-36" />
            </div>
          )}
          <div className="ml-auto">
            <Link href="/other-purchases/new" className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
              <Plus className="w-4 h-4" /> Phiếu nhập
            </Link>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-slate-500 mb-1">Tổng phiếu kỳ này</p>
            <p className="text-2xl font-bold">{purchases.length}</p>
          </div>
          <div className="card p-4 kpi-blue">
            <p className="text-xs text-slate-500 mb-1">Tổng chi kỳ này</p>
            <p className="text-xl font-bold text-blue-400">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="card p-4 kpi-green">
            <p className="text-xs text-slate-500 mb-1">Lợi nhuận ước tính</p>
            <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Nếu bán hết</p>
          </div>
          <div className={`card p-4 ${oweCount > 0 ? 'kpi-red' : ''}`}>
            <p className="text-xs text-slate-500 mb-1">Đang nợ NCC</p>
            <p className={`text-2xl font-bold ${oweCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
              {oweCount} phiếu
            </p>
          </div>
        </div>

        {/* NCC Debt Warning */}
        {oweCount > 0 && (
          <div className="card p-4 border-yellow-500/30 bg-yellow-500/5 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-yellow-200">
                Có <strong>{oweCount} phiếu</strong> chưa thanh toán cho nhà cung cấp.
                Tổng nợ NCC: <strong className="text-yellow-300">{formatCurrency(oweTotalAmount)}</strong>
              </p>
              <p className="text-xs text-yellow-500 mt-0.5">Bấm ✅ ở từng phiếu để đánh dấu đã thanh toán</p>
            </div>
          </div>
        )}

        {/* Inline delete confirm */}
        {deleteId && delPurchase && (
          <div className="card p-4 border-red-500/40 bg-red-500/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm text-red-200">
                  Xóa phiếu <strong>{delPurchase.purchaseNo}</strong>?
                  {delPurchase.status === 'received' && (
                    <span className="text-red-400"> Tồn kho sẽ được hoàn tác.</span>
                  )}
                </p>
                {deleteError && <p className="text-xs text-red-400 mt-1">{deleteError}</p>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-colors">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Xác nhận xóa
              </button>
              <button onClick={() => { setDeleteId(null); setDeleteError('') }} className="btn-ghost text-sm">Hủy</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2 mb-4">
            <ShoppingBag className="w-4 h-4 text-purple-400" /> Danh sách phiếu nhập SP Khác
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <ShoppingBag className="w-10 h-10 mb-3 opacity-30" />
              <p>Chưa có phiếu nhập trong kỳ này</p>
              <Link href="/other-purchases/new" className="mt-3 text-purple-400 hover:text-purple-300 text-sm">
                + Tạo phiếu nhập đầu tiên
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {purchases.map(p => {
                const isExpanded = expandId === p.id
                // Tính lợi nhuận ước tính của phiếu
                const profitEst = p.items.reduce((s, item) => {
                  const costPrice = item.product.costPrice ?? item.unitCost
                  return s + (item.product.priceRetail - costPrice) * item.qty
                }, 0)

                return (
                  <div key={p.id} className="border border-slate-700/50 rounded-xl overflow-hidden">
                    {/* Header row */}
                    <div
                      className={`flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors cursor-pointer ${deleteId === p.id ? 'bg-red-500/5' : ''}`}
                      onClick={() => setExpandId(isExpanded ? null : p.id)}
                    >
                      {/* Mã phiếu */}
                      <span className="font-mono text-xs text-purple-400 whitespace-nowrap w-20 shrink-0">
                        {p.purchaseNo}
                      </span>

                      {/* Ngày */}
                      <span className="text-xs text-slate-500 whitespace-nowrap w-20 shrink-0">
                        {formatDate(p.purchaseDate)}
                      </span>

                      {/* NCC */}
                      <span className="text-sm text-slate-300 w-28 shrink-0 truncate">
                        {p.supplier?.name ?? <span className="text-slate-600">—</span>}
                      </span>

                      {/* Tóm tắt hàng hóa */}
                      <div className="text-xs text-slate-400 flex-1 truncate">
                        {p.items.map(i => `${i.product.name} ×${i.qty} ${i.product.unit}`).join(' · ')}
                      </div>

                      {/* Lợi nhuận */}
                      <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
                        <TrendingUp className={`w-3.5 h-3.5 ${profitEst >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                        <span className={`text-xs font-medium ${profitEst >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {profitEst >= 0 ? '+' : ''}{formatCurrency(profitEst)}
                        </span>
                      </div>

                      {/* Tổng tiền */}
                      <span className="font-bold text-blue-400 whitespace-nowrap shrink-0">
                        {formatCurrency(p.totalAmount)}
                      </span>

                      {/* Trạng thái */}
                      <div className="shrink-0">
                        {p.paymentStatus === 'paid'
                          ? <span className="badge-green text-xs">Đã trả</span>
                          : <span className="badge-yellow text-xs">Nợ NCC</span>}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Link href={`/other-purchases/${p.id}`}
                          className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Xem chi tiết">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        {p.paymentStatus === 'owe' && (
                          <button
                            onClick={() => markPaid(p.id)}
                            className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Đánh dấu đã thanh toán NCC">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => { setDeleteId(p.id); setDeleteError('') }}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Xóa phiếu">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-slate-700/50 p-4 bg-slate-800/20">
                        <table className="table text-sm">
                          <thead>
                            <tr>
                              <th>Sản phẩm</th>
                              <th>ĐVT</th>
                              <th className="text-right">SL nhập</th>
                              <th className="text-right">Giá nhập</th>
                              <th className="text-right">Giá vốn</th>
                              <th className="text-right">Giá bán lẻ</th>
                              <th className="text-right">Lợi nhuận/đv</th>
                              <th className="text-right">Thành tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.items.map(item => {
                              const costPrice = item.product.costPrice ?? item.unitCost
                              const profitPerUnit = item.product.priceRetail - costPrice
                              return (
                                <tr key={item.id}>
                                  <td className="font-medium text-purple-300">{item.product.name}</td>
                                  <td className="text-slate-400">{item.product.unit}</td>
                                  <td className="text-right">{item.qty.toLocaleString('vi-VN')}</td>
                                  <td className="text-right">{formatCurrency(item.unitCost)}</td>
                                  <td className="text-right">{formatCurrency(costPrice)}</td>
                                  <td className="text-right">{formatCurrency(item.product.priceRetail)}</td>
                                  <td className={`text-right font-medium ${profitPerUnit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {profitPerUnit >= 0 ? '+' : ''}{formatCurrency(profitPerUnit)}
                                  </td>
                                  <td className="text-right font-semibold text-blue-400">{formatCurrency(item.subtotal)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="font-bold text-sm">
                              <td colSpan={7} className="text-right text-slate-300">Tổng phiếu:</td>
                              <td className="text-right text-blue-400">{formatCurrency(p.totalAmount)}</td>
                            </tr>
                            <tr className="text-sm">
                              <td colSpan={7} className="text-right text-slate-400">Lợi nhuận ước tính:</td>
                              <td className={`text-right font-semibold ${profitEst >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {profitEst >= 0 ? '+' : ''}{formatCurrency(profitEst)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                        {p.note && <p className="text-xs text-slate-400 italic mt-3">Ghi chú: {p.note}</p>}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Tổng kết */}
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl font-bold text-sm mt-2">
                <span className="text-slate-300">Tổng kỳ ({purchases.length} phiếu)</span>
                <div className="flex items-center gap-6">
                  <span className={`${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    LN ước tính: {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
                  </span>
                  <span className="text-blue-400">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
