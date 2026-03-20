'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Package, User, CreditCard,
  CheckCircle, Clock, AlertTriangle, Trash2, Edit3, Save, X
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const STATUS_MAP: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: 'Chờ xử lý', cls: 'badge-yellow', icon: Clock },
  completed: { label: 'Hoàn tất',  cls: 'badge-green',  icon: CheckCircle },
  // legacy fallback
  delivered: { label: 'Hoàn tất',  cls: 'badge-green',  icon: CheckCircle },
}

const PAY_MAP: Record<string, string> = {
  cash: 'Tiền mặt', transfer: 'Chuyển khoản', debt: 'Công nợ',
}

type ConfirmMode = 'complete' | 'delete' | null

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmMode>(null)
  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editNote, setEditNote] = useState('')
  const [editPaid, setEditPaid] = useState<number | ''>('')
  const [editPayMethod, setEditPayMethod] = useState('')
  // Quick pay (thu tiền bổ sung)
  const [showQuickPay, setShowQuickPay] = useState(false)
  const [quickPayAmt, setQuickPayAmt] = useState<number | ''>('')
  const [quickPayWorking, setQuickPayWorking] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/orders/${params.id}`)
    if (res.ok) setOrder(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  function openEdit() {
    setEditNote(order.note ?? '')
    setEditPaid(order.paidAmount)
    setEditPayMethod(order.paymentMethod)
    setEditing(true)
  }

  async function saveEdit() {
    setWorking(true)
    const res = await fetch(`/api/orders/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: editNote,
        paidAmount: Number(editPaid) || 0,
        paymentMethod: editPayMethod,
      }),
    })
    if (res.ok) { setOrder(await res.json()); setEditing(false) }
    setWorking(false)
  }

  async function completeOrder() {
    setWorking(true)
    setConfirm(null)
    const res = await fetch(`/api/orders/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    if (res.ok) setOrder(await res.json())
    setWorking(false)
  }

  async function deleteOrder() {
    setWorking(true)
    setConfirm(null)
    const res = await fetch(`/api/orders/${params.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/orders')
    else setWorking(false)
  }

  async function collectDebt() {
    if (!quickPayAmt || Number(quickPayAmt) <= 0) return
    setQuickPayWorking(true)
    const addPaid = Number(quickPayAmt)
    const newPaid = Math.min((order.paidAmount ?? 0) + addPaid, order.totalAmount)
    const res = await fetch(`/api/orders/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paidAmount: newPaid, paymentMethod: order.paymentMethod }),
    })
    if (res.ok) { setOrder(await res.json()); setShowQuickPay(false); setQuickPayAmt('') }
    setQuickPayWorking(false)
  }

  if (loading) return (
    <div className="flex flex-col flex-1">
      <Header title="Chi tiết đơn hàng" subtitle="Đang tải..." />
      <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
    </div>
  )

  if (!order) return (
    <div className="flex flex-col flex-1">
      <Header title="Không tìm thấy" subtitle="Đơn hàng không tồn tại" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Đơn hàng không tồn tại hoặc đã bị xóa.</p>
        <Link href="/orders" className="btn-primary">← Quay lại danh sách</Link>
      </div>
    </div>
  )

  const s = STATUS_MAP[order.status] ?? { label: order.status, cls: 'badge-gray', icon: Clock }
  const StatusIcon = s.icon
  const isPending = order.status === 'pending'
  const hasDebt = (order.debtAmount ?? 0) > 0
  const itemCount = (order.items ?? []).reduce((s: number, i: any) => s + i.qty, 0)
  const gasItemCount = (order.items ?? [])
    .filter((i: any) => i.product?.type === 'gas')
    .reduce((s: number, i: any) => s + i.qty, 0)

  // Delete preview text
  const deleteConsequences = [
    `Hoàn lại ${itemCount} sản phẩm vào kho`,
    ...(gasItemCount > 0 && order.cylinderTxType ? [`Hoàn lại ${Math.ceil(gasItemCount)} bình gas về kho`] : []),
    ...(hasDebt ? [`Trừ ${formatCurrency(order.debtAmount)} khỏi công nợ của ${order.customer?.name}`] : []),
  ]

  return (
    <div className="flex flex-col flex-1">
      <Header title={`Đơn hàng ${order.orderNo}`} subtitle="Chi tiết đơn hàng" />

      <main className="flex-1 p-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/orders" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Danh sách đơn hàng</Link>

          {!editing && confirm === null && (
            <div className="flex items-center gap-2">
              {isPending && (
                <button onClick={() => setConfirm('complete')} disabled={working}
                  className="btn-primary text-sm">
                  <CheckCircle className="w-4 h-4" /> Hoàn tất đơn
                </button>
              )}
              <button onClick={openEdit} disabled={working}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/60 text-slate-300 hover:bg-slate-700 border border-slate-600 transition-all flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" /> Sửa
              </button>
              <button onClick={() => setConfirm('delete')} disabled={working}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
            </div>
          )}
        </div>

        {/* ── CONFIRM: Hoàn tất ── */}
        {confirm === 'complete' && (
          <div className={`card p-4 border-emerald-500/40 bg-emerald-500/10 flex items-start justify-between gap-4`}>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-200 mb-1">Xác nhận hoàn tất đơn hàng?</p>
                {hasDebt && (
                  <p className="text-xs text-yellow-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Đơn còn thiếu <strong className="mx-1">{formatCurrency(order.debtAmount)}</strong>. Xác nhận hoàn tất không thu đủ tiền?
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={completeOrder} disabled={working} className="btn-primary text-sm">
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Xác nhận hoàn tất
              </button>
              <button onClick={() => setConfirm(null)} className="btn-ghost text-sm">Quay lại</button>
            </div>
          </div>
        )}

        {/* ── CONFIRM: Xóa ── */}
        {confirm === 'delete' && (
          <div className="card p-4 border-red-500/40 bg-red-500/10">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-200 mb-2">Xóa đơn {order.orderNo} sẽ:</p>
                <ul className="text-xs text-slate-300 space-y-1">
                  {deleteConsequences.map((c, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-red-400 inline-block shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-red-400 mt-2 font-medium">Không thể khôi phục. Tiếp tục?</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={deleteOrder} disabled={working}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-2">
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Xóa vĩnh viễn
              </button>
              <button onClick={() => setConfirm(null)} className="btn-ghost text-sm">Hủy</button>
            </div>
          </div>
        )}

        {/* ── EDIT FORM ── */}
        {editing && (
          <div className="card p-5 border-blue-500/30 bg-blue-500/5">
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><Edit3 className="w-4 h-4 text-blue-400" /> Chỉnh sửa đơn hàng</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Phương thức TT</label>
                <select value={editPayMethod} onChange={e => setEditPayMethod(e.target.value)} className="input">
                  <option value="cash">Tiền mặt</option>
                  <option value="transfer">Chuyển khoản</option>
                  <option value="debt">Công nợ</option>
                </select>
              </div>
              <div>
                <label className="label">Đã trả (đ)</label>
                <input type="number" min={0} max={order.totalAmount} value={editPaid}
                  onChange={e => setEditPaid(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input" />
                {editPaid !== '' && (
                  <p className="text-xs mt-1">
                    {Math.max(0, order.totalAmount - Number(editPaid)) > 0
                      ? <span className="text-red-400">Còn nợ: {formatCurrency(Math.max(0, order.totalAmount - Number(editPaid)))}</span>
                      : <span className="text-emerald-400">Đã thanh toán đủ</span>
                    }
                  </p>
                )}
              </div>
              <div className="sm:col-span-1">
                <label className="label">Ghi chú</label>
                <input value={editNote} onChange={e => setEditNote(e.target.value)} className="input" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={working} className="btn-primary text-sm">
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu thay đổi
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost text-sm"><X className="w-4 h-4" /> Hủy</button>
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-400" /> Thông tin đơn
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Mã đơn</span><span className="font-mono text-orange-400">{order.orderNo}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">Trạng thái</span><span className={s.cls}><StatusIcon className="w-3 h-3 inline mr-1" />{s.label}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ngày tạo</span><span>{formatDateTime(order.createdAt)}</span></div>
              {order.deliveredAt && <div className="flex justify-between"><span className="text-slate-500">Hoàn tất lúc</span><span>{formatDateTime(order.deliveredAt)}</span></div>}
              {order.cylinderTxType && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Loại vỏ bình</span>
                  <span className="text-orange-400 text-xs font-medium">
                    {order.cylinderTxType === 'exchange' ? '🔄 Đổi bình' : '📦 Mượn vỏ'}
                  </span>
                </div>
              )}
              {order.note && <div className="pt-2 border-t border-slate-800 text-slate-400 italic text-xs">{order.note}</div>}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" /> Khách hàng
            </h3>
            {order.customer && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Tên</span><Link href={`/customers/${order.customerId}`} className="text-orange-400 hover:text-orange-300">{order.customer.name}</Link></div>
                <div className="flex justify-between"><span className="text-slate-500">SĐT</span><span>{order.customer.phone}</span></div>
                {order.customer.address && <div className="flex justify-between"><span className="text-slate-500">Địa chỉ</span><span className="text-right max-w-[60%]">{order.customer.address}</span></div>}
              </div>
            )}
          </div>

          <div className={`card p-5 ${hasDebt ? 'kpi-red' : 'kpi-green'}`}>
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400" /> Thanh toán
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Tổng tiền</span><span className="font-bold text-lg text-orange-400">{formatCurrency(order.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Phương thức</span><span>{PAY_MAP[order.paymentMethod] ?? order.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Đã trả</span><span className="text-emerald-400">{formatCurrency(order.paidAmount)}</span></div>
              {hasDebt && <div className="flex justify-between"><span className="text-slate-500">Còn nợ</span><span className="font-bold text-red-400">{formatCurrency(order.debtAmount)}</span></div>}
              {order.cylinderDeposit > 0 && <div className="flex justify-between"><span className="text-slate-500">Cọc vỏ bình</span><span className="text-emerald-400">{formatCurrency(order.cylinderDeposit)}</span></div>}
              {/* Quick pay button */}
              {hasDebt && (
                <div className="pt-2 border-t border-slate-700/50">
                  {showQuickPay ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Nhập số tiền thu:</p>
                      <div className="flex gap-2">
                        <input type="number" min={1} max={order.debtAmount} value={quickPayAmt}
                          onChange={e => setQuickPayAmt(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder={`Tối đa ${formatCurrency(order.debtAmount)}`}
                          className="input text-sm flex-1" />
                        <button onClick={() => setQuickPayAmt(order.debtAmount)}
                          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-2 whitespace-nowrap">
                          Thu hết
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={collectDebt} disabled={quickPayWorking || !quickPayAmt}
                          className="btn-primary text-xs flex-1">
                          {quickPayWorking ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          Xác nhận thu tiền
                        </button>
                        <button onClick={() => { setShowQuickPay(false); setQuickPayAmt('') }} className="btn-ghost text-xs">Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowQuickPay(true)}
                      className="w-full text-center text-xs font-medium text-emerald-400 hover:text-emerald-300 py-1 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors">
                      + Thu tiền bổ sung
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-200 mb-4">Chi tiết sản phẩm</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Sản phẩm</th><th>Đơn vị</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
              <tbody>
                {(order.items ?? []).map((item: any) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.product?.name}</td>
                    <td>{item.product?.unit}</td>
                    <td>{item.qty}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td className="font-semibold text-orange-400">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-800/50">
                  <td colSpan={4} className="text-right font-semibold text-slate-300">Tổng cộng</td>
                  <td className="font-bold text-lg text-orange-400">{formatCurrency(order.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
