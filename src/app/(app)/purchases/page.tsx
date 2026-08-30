'use client'

import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { Truck, Plus, Loader2, Trash2, AlertTriangle, Calendar, CheckCircle } from 'lucide-react'
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

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Date filter
  const [preset, setPreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  async function load() {
    setLoading(true)
    const range = getRange(preset, customFrom, customTo)
    const params = new URLSearchParams({ from: range.from, to: range.to })
    const d = await fetch(`/api/purchases?${params}`).then(r => r.ok ? r.json() : []).catch(() => [])
    setPurchases(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [preset, customFrom, customTo])

  async function handleDelete(id: string) {
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
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
    const res = await fetch(`/api/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'paid' }),
    })
    if (res.ok) await load()
  }

  // KPI — fix: dùng purchaseDate (không phải createdAt)
  const totalAmount = useMemo(() => purchases.reduce((s: number, p: any) => s + p.totalAmount, 0), [purchases])
  const oweCount = useMemo(() => purchases.filter((p: any) => p.paymentStatus === 'owe').length, [purchases])
  const oweTotalAmount = useMemo(() =>
    purchases.filter((p: any) => p.paymentStatus === 'owe').reduce((s: number, p: any) => s + p.totalAmount, 0),
    [purchases]
  )

  const delPurchase = purchases.find(p => p.id === deleteId)

  return (
    <div className="flex flex-col flex-1">
      <Header title="Nhập Hàng (Gas)" subtitle="Quản lý phiếu nhập hàng gas và nhà cung cấp" />
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
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-blue-500/50'
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
            <Link href="/purchases/new" className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
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
            <p className="text-xs text-slate-500 mb-1">Đã thanh toán NCC</p>
            <p className="text-xl font-bold text-emerald-400">
              {purchases.filter((p: any) => p.paymentStatus === 'paid').length} phiếu
            </p>
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
                Có <strong>{oweCount} phiếu</strong> chưa thanh toán cho nhà cung cấp gas.
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
                    <span className="text-red-400"> Tồn kho và vỏ bình sẽ được hoàn tác.</span>
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
        <div className="table-wrap">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Truck className="w-10 h-10 mb-3 opacity-30" />
              <p>Chưa có phiếu nhập trong kỳ này</p>
              <Link href="/purchases/new" className="mt-3 text-blue-400 hover:text-blue-300 text-sm">+ Tạo phiếu nhập đầu tiên</Link>
            </div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Nhà cung cấp</th>
                    <th>Hàng hóa</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th>Ngày nhập</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p: any) => (
                    <tr key={p.id} className={deleteId === p.id ? 'bg-red-500/5' : 'hover:bg-slate-800/40 cursor-pointer'}>
                      <td>
                        <Link href={`/purchases/${p.id}`} className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline">
                          {p.purchaseNo}
                        </Link>
                      </td>
                      <td className="font-medium">{p.supplier?.name}</td>
                      <td><div className="text-xs text-slate-400">{p.items?.map((i: any) => `${i.qty} ${i.product?.unit} ${i.product?.name}`).join(', ')}</div></td>
                      <td className="font-medium">{formatCurrency(p.totalAmount)}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {p.status === 'received' && <span className="badge-green">Đã nhập kho</span>}
                          {p.status === 'draft'    && <span className="badge-yellow">Nháp</span>}
                          {p.status === 'pending'  && <span className="badge-yellow">Chờ</span>}
                          {p.paymentStatus === 'owe'
                            ? <span className="text-xs font-medium text-yellow-400">· Nợ NCC</span>
                            : <span className="text-xs font-medium text-emerald-500">· Đã trả</span>
                          }
                        </div>
                      </td>
                      <td className="text-xs text-slate-500">{formatDate(p.purchaseDate ?? p.receivedAt ?? p.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/purchases/${p.id}`}
                            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Xem chi tiết">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          {p.paymentStatus === 'owe' && (
                            <button
                              onClick={() => markPaid(p.id)}
                              className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                              title="Đánh dấu đã thanh toán NCC">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => { setDeleteId(p.id); setDeleteError('') }}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Xóa phiếu nhập">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800/50 font-bold">
                    <td colSpan={3} className="text-right text-slate-300">Tổng kỳ ({purchases.length} phiếu)</td>
                    <td className="text-blue-400">{formatCurrency(totalAmount)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
