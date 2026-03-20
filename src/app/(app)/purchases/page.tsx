'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { Truck, Plus, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function load() {
    setLoading(true)
    const d = await fetch('/api/purchases').then(r => r.ok ? r.json() : []).catch(() => [])
    setPurchases(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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

  const delPurchase = purchases.find(p => p.id === deleteId)

  return (
    <div className="flex flex-col flex-1">
      <Header title="Nhập Hàng" subtitle="Quản lý nhập hàng và nhà cung cấp" />
      <main className="flex-1 p-6 space-y-5">
        <div className="flex justify-between items-center">
          <div className="grid grid-cols-3 gap-3 flex-1 mr-4">
            <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Tổng phiếu</p><p className="text-xl font-bold">{purchases.length}</p></div>
            <div className="card p-4 kpi-green">
              <p className="text-xs text-slate-500 mb-1">Tháng này</p>
              <p className="text-xl font-bold text-emerald-400">
                {purchases.filter((p: any) => new Date(p.createdAt).getMonth() === new Date().getMonth()).length}
              </p>
            </div>
            <div className="card p-4 kpi-blue">
              <p className="text-xs text-slate-500 mb-1">Tổng chi</p>
              <p className="text-lg font-bold text-blue-400">{formatCurrency(purchases.reduce((s: number, p: any) => s + p.totalAmount, 0))}</p>
            </div>
          </div>
          <Link href="/purchases/new" className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" />
            Phiếu nhập
          </Link>
        </div>

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

        <div className="table-wrap">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
          ) : purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Truck className="w-10 h-10 mb-3 opacity-30" />
              <p>Chưa có phiếu nhập hàng</p>
            </div>
          ) : (
            <table className="table">
              <thead><tr>
                <th>Mã phiếu</th><th>Nhà cung cấp</th><th>Hàng hóa</th><th>Tổng tiền</th><th>Trạng thái</th><th>Ngày nhận</th><th className="w-10"></th>
              </tr></thead>
              <tbody>
                {purchases.map((p: any) => (
                  <tr key={p.id} className={deleteId === p.id ? 'bg-red-500/5' : ''}>
                    <td><span className="font-mono text-xs text-blue-400">{p.purchaseNo}</span></td>
                    <td className="font-medium">{p.supplier?.name}</td>
                    <td><div className="text-xs text-slate-400">{p.items?.map((i: any) => `${i.qty} ${i.product?.unit} ${i.product?.name}`).join(', ')}</div></td>
                    <td className="font-medium">{formatCurrency(p.totalAmount)}</td>
                    <td>
                      {p.status === 'received' && <span className="badge-green">Đã nhập kho</span>}
                      {p.status === 'draft'    && <span className="badge-yellow">Nháp</span>}
                      {p.status === 'pending'  && <span className="badge-yellow">Chờ</span>}
                      {p.paymentStatus === 'owe' && (
                        <span className="ml-1 text-xs font-medium text-yellow-400">· Nợ NCC</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(p.purchaseDate ?? p.receivedAt ?? p.createdAt)}</td>
                    <td>
                      <button
                        onClick={() => { setDeleteId(p.id); setDeleteError('') }}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1"
                        title="Xóa phiếu nhập"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
