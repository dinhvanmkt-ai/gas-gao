'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Truck, Package, Calendar, CheckCircle,
  Trash2, AlertTriangle, FileText, Flame
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'

export default function PurchaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [purchase, setPurchase] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/purchases/${id}`)
      .then(r => r.json())
      .then(d => { setPurchase(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function markPaid() {
    setMarkingPaid(true)
    const res = await fetch(`/api/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'paid' }),
    })
    if (res.ok) setPurchase((p: any) => ({ ...p, paymentStatus: 'paid' }))
    setMarkingPaid(false)
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/purchases')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Không thể xóa')
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col flex-1">
      <Header title="Chi tiết phiếu nhập" subtitle="" />
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </main>
    </div>
  )

  if (!purchase || purchase.error) return (
    <div className="flex flex-col flex-1">
      <Header title="Phiếu nhập" subtitle="" />
      <main className="flex-1 p-6">
        <Link href="/purchases" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Quay lại</Link>
        <p className="mt-6 text-slate-500 text-center">Không tìm thấy phiếu nhập</p>
      </main>
    </div>
  )

  const totalAmount = purchase.items?.reduce((s: number, i: any) => s + i.subtotal, 0) ?? purchase.totalAmount

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={purchase.purchaseNo}
        subtitle={`Phiếu nhập hàng • ${purchase.supplier?.name ?? '—'}`}
      />
      <main className="flex-1 p-6 space-y-5 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <Link href="/purchases" className="btn-ghost text-sm">
            <ArrowLeft className="w-4 h-4" /> Danh sách nhập hàng
          </Link>
          <div className="flex gap-2">
            {purchase.paymentStatus === 'owe' && (
              <button onClick={markPaid} disabled={markingPaid}
                className="btn-primary text-sm flex items-center gap-1.5">
                {markingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Đánh dấu đã trả NCC
              </button>
            )}
            <button onClick={() => setDeleteConfirm(true)}
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="card p-4 border-red-500/40 bg-red-500/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-200 font-medium">Xóa phiếu nhập {purchase.purchaseNo}?</p>
                {purchase.status === 'received' && (
                  <p className="text-xs text-red-400 mt-1">⚠️ Tồn kho sẽ được hoàn tác (trừ lại số hàng đã nhập)</p>
                )}
                {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Xác nhận xóa
              </button>
              <button onClick={() => { setDeleteConfirm(false); setError('') }} className="btn-ghost text-sm">Hủy</button>
            </div>
          </div>
        )}

        {/* Thông tin phiếu */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-blue-400" /> Thông tin phiếu
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">Mã phiếu</p>
              <p className="font-mono font-bold text-blue-400 text-base">{purchase.purchaseNo}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Nhà cung cấp</p>
              <p className="font-medium text-slate-200 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                {purchase.supplier?.name ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Ngày nhập</p>
              <p className="text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(purchase.purchaseDate ?? purchase.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Trạng thái kho</p>
              {purchase.status === 'received'
                ? <span className="badge-green">✅ Đã nhập kho</span>
                : <span className="badge-yellow">⏳ {purchase.status === 'draft' ? 'Nháp' : 'Chờ'}</span>
              }
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Thanh toán NCC</p>
              {purchase.paymentStatus === 'paid'
                ? <span className="text-emerald-400 text-sm font-medium">✅ Đã trả</span>
                : <span className="text-yellow-400 text-sm font-medium">⏳ Còn nợ</span>
              }
            </div>
            {purchase.cylinderTxType && (
              <div>
                <p className="text-slate-500 text-xs mb-1">Giao dịch vỏ bình</p>
                <p className="text-slate-300 text-sm">
                  {purchase.cylinderTxType === 'exchange' ? '🔄 Đổi vỏ rỗng → đầy' : '🆕 Mua vỏ mới'}
                  {purchase.cylinderQty > 0 && <span className="text-slate-500 ml-1">({purchase.cylinderQty} bình)</span>}
                </p>
              </div>
            )}
            {purchase.note && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-slate-500 text-xs mb-1">Ghi chú</p>
                <p className="text-slate-300 text-sm">{purchase.note}</p>
              </div>
            )}
          </div>
        </div>

        {/* Chi tiết hàng hóa */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-blue-400" /> Hàng hóa nhập
          </h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th className="text-center w-28">Số lượng</th>
                  <th className="text-right w-36">Đơn giá nhập</th>
                  <th className="text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td>
                      <span className="font-medium text-slate-200 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        {item.product?.name}
                      </span>
                    </td>
                    <td className="text-center font-semibold text-blue-300">
                      {item.qty} <span className="text-slate-500 font-normal text-xs">{item.product?.unit}</span>
                    </td>
                    <td className="text-right text-slate-300">{formatCurrency(item.unitCost)}</td>
                    <td className="text-right font-bold text-blue-400">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-800/60 font-bold">
                  <td colSpan={3} className="text-right text-slate-300">Tổng chi phiếu nhập</td>
                  <td className="text-right text-xl text-blue-400">{formatCurrency(totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-600 text-center">
          Tạo lúc {formatDateTime(purchase.createdAt)}
        </p>
      </main>
    </div>
  )
}
