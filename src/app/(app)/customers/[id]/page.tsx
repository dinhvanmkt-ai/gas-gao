'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import {
  ArrowLeft, Phone, MapPin, StickyNote, Flame, Wheat,
  Package, CreditCard, Edit3, Trash2, Loader2, Save, X,
  ShoppingCart, Calendar, AlertTriangle
} from 'lucide-react'
import { formatCurrency, formatDate, daysUntil, urgencyColor, urgencyLabel } from '@/lib/utils'

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/customers/${params.id}`)
    if (res.ok) {
      const data = await res.json()
      setCustomer(data)
      setForm({ name: data.name, phone: data.phone, address: data.address ?? '', notes: data.notes ?? '' })
      setNotesValue(data.notes ?? '')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/customers/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      setCustomer({ ...customer, ...data })
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/customers/${params.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/customers')
    } else {
      const data = await res.json()
      setDeleteError(data.error ?? 'Không thể xóa khách hàng.')
      setConfirmDelete(false)
      setDeleting(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    const res = await fetch(`/api/customers/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, notes: notesValue }),
    })
    if (res.ok) {
      setCustomer({ ...customer, notes: notesValue })
      setEditingNotes(false)
    }
    setSavingNotes(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Chi tiết khách hàng" subtitle="Đang tải..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Không tìm thấy" subtitle="Khách hàng không tồn tại" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-slate-500">Khách hàng không tồn tại hoặc đã bị xóa.</p>
          <Link href="/customers" className="btn-primary">← Quay lại danh sách</Link>
        </div>
      </div>
    )
  }

  const gasDays = daysUntil(customer.gasPredictedDate)
  const riceDays = daysUntil(customer.ricePredictedDate)

  return (
    <div className="flex flex-col flex-1">
      <Header title={customer.name} subtitle="Chi tiết khách hàng" />

      <main className="flex-1 p-6 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link href="/customers" className="btn-ghost text-sm">
            <ArrowLeft className="w-4 h-4" /> Danh sách khách hàng
          </Link>
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
                  <Edit3 className="w-4 h-4" /> Sửa
                </button>
                <button onClick={() => { setConfirmDelete(true); setDeleteError('') }} disabled={deleting} className="btn-danger text-sm">
                  <Trash2 className="w-4 h-4" /> Xóa
                </button>
              </>
            ) : (
              <>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                  <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button onClick={() => setEditing(false)} className="btn-ghost text-sm">
                  <X className="w-4 h-4" /> Hủy
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inline delete confirm */}
        {confirmDelete && (
          <div className="card p-4 border-red-500/40 bg-red-500/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-200">Xóa vĩnh viễn khách hàng <strong>{customer.name}</strong>? Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-colors">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Xác nhận xóa
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost text-sm">Hủy</button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {deleteError && (
          <div className="card p-4 border-red-500/40 bg-red-500/10 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{deleteError}</p>
            <button onClick={() => setDeleteError('')} className="ml-auto text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Customer info card */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" /> Thông tin
            </h3>
            {editing ? (
              <div className="space-y-3">
                <div><label className="label">Tên</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" /></div>
                <div><label className="label">Số điện thoại</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></div>
                <div><label className="label">Địa chỉ</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input" /></div>
                <div><label className="label">Ghi chú</label><textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input" /></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-slate-500" /><span>{customer.phone}</span></div>
                <div className="flex items-center gap-2 text-sm"><MapPin className="w-3.5 h-3.5 text-slate-500" /><span>{customer.address || '—'}</span></div>
                <div className="flex items-start gap-2 text-sm"><StickyNote className="w-3.5 h-3.5 text-slate-500 mt-0.5" /><span>{customer.notes || '—'}</span></div>
                <div className="flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-slate-500" /><span className="text-slate-500">Tạo: {formatDate(customer.createdAt)}</span></div>
              </div>
            )}
          </div>

          {/* Prediction cards */}
          <div className="space-y-4">
            {/* Gas prediction */}
            <div className={`card p-5 ${gasDays !== null && gasDays <= 3 ? 'kpi-red' : 'kpi-orange'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-orange-400" />
                <h3 className="font-semibold text-slate-200">Gas</h3>
                <span className={urgencyColor(customer.urgencyScore)}>{urgencyLabel(customer.urgencyScore)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-slate-500 mb-0.5">Chu kỳ trung bình</p><p className="font-semibold">{customer.gasAvgDays ? `${Math.round(customer.gasAvgDays)} ngày` : '—'}</p></div>
                <div><p className="text-xs text-slate-500 mb-0.5">Lần mua gần nhất</p><p className="font-semibold">{formatDate(customer.gasLastBuyDate)}</p></div>
                <div><p className="text-xs text-slate-500 mb-0.5">Lượng mua</p><p className="font-semibold">{customer.gasLastQty ? `${customer.gasLastQty} kg` : '—'}</p></div>
                <div><p className="text-xs text-slate-500 mb-0.5">Dự đoán mua</p>
                  <p className={`font-semibold ${gasDays !== null && gasDays <= 0 ? 'text-red-400' : gasDays !== null && gasDays <= 3 ? 'text-yellow-400' : ''}`}>
                    {customer.gasPredictedDate ? formatDate(customer.gasPredictedDate) : '—'}
                    {gasDays !== null && <span className="text-xs ml-1">({gasDays <= 0 ? 'Quá hạn' : `${gasDays} ngày`})</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Rice prediction */}
            <div className={`card p-5 ${riceDays !== null && riceDays <= 3 ? 'kpi-red' : 'kpi-blue'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Wheat className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-slate-200">Gạo</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-slate-500 mb-0.5">Chu kỳ trung bình</p><p className="font-semibold">{customer.riceAvgDays ? `${Math.round(customer.riceAvgDays)} ngày` : '—'}</p></div>
                <div><p className="text-xs text-slate-500 mb-0.5">Lần mua gần nhất</p><p className="font-semibold">{formatDate(customer.riceLastBuyDate)}</p></div>
                <div><p className="text-xs text-slate-500 mb-0.5">Lượng mua</p><p className="font-semibold">{customer.riceLastQty ? `${customer.riceLastQty} kg` : '—'}</p></div>
                <div><p className="text-xs text-slate-500 mb-0.5">Dự đoán mua</p>
                  <p className={`font-semibold ${riceDays !== null && riceDays <= 0 ? 'text-red-400' : riceDays !== null && riceDays <= 3 ? 'text-yellow-400' : ''}`}>
                    {customer.ricePredictedDate ? formatDate(customer.ricePredictedDate) : <span className="text-xs text-slate-500 italic">Cần ít nhất 2 đơn gạo để dự đoán</span>}
                    {riceDays !== null && <span className="text-xs ml-1">({riceDays <= 0 ? 'Quá hạn' : `${riceDays} ngày`})</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Debt & Cylinders */}
          <div className="space-y-4">
            <div className={`card p-5 ${customer.debtBalance > 0 ? 'kpi-red' : 'kpi-green'}`}>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-200">Công nợ</h3>
              </div>
              <p className={`text-2xl font-bold ${customer.debtBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatCurrency(customer.debtBalance)}
              </p>
              {customer.debtBalance > 0 && <p className="text-xs text-red-400/70 mt-1">Khách hàng đang nợ chưa thanh toán</p>}
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-400" />
                  <h3 className="font-semibold text-slate-200">Vỏ bình gas</h3>
                </div>
                {customer.gasCylinderQty > 0 && (
                  <Link href="/cylinders/return" className="btn-ghost text-xs py-1">
                    Trả vỏ →
                  </Link>
                )}
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                  <span className="text-sm text-slate-400">Vỏ đang mượn</span>
                  <span className={`font-bold text-lg ${customer.gasCylinderQty > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                    {customer.gasCylinderQty} bình
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                  <span className="text-sm text-slate-400">Tiền cọc vỏ</span>
                  <span className={`font-semibold ${customer.cylinderDeposit > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {customer.cylinderDeposit > 0 ? formatCurrency(customer.cylinderDeposit) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm text-slate-400">Nợ vỏ</span>
                  <span className={`font-semibold ${customer.cylinderDebt > 0 ? 'text-red-400' : 'text-slate-600'}`}>
                    {customer.cylinderDebt > 0 ? `${customer.cylinderDebt} bình` : '—'}
                  </span>
                </div>
              </div>
              {customer.gasCylinderQty >= 3 && (
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> Đang giữ nhiều vỏ, cần nhắc trả
                </div>
              )}
            </div>
          </div>

          {/* Inline Notes */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-200">Ghi chú</h3>
              </div>
              {!editingNotes ? (
                <button onClick={() => { setNotesValue(customer.notes ?? ''); setEditingNotes(true) }} className="btn-ghost text-xs">
                  <Edit3 className="w-3 h-3" /> Sửa
                </button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={saveNotes} disabled={savingNotes} className="btn-primary text-xs py-1">
                    {savingNotes ? 'Lưu...' : 'Lưu'}
                  </button>
                  <button onClick={() => setEditingNotes(false)} className="btn-ghost text-xs py-1">Hủy</button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                rows={3}
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                className="input w-full text-sm"
                placeholder="Nhập ghi chú về khách hàng..."
                autoFocus
              />
            ) : (
              <p className="text-sm text-slate-400">{customer.notes || <span className="italic text-slate-600">Chưa có ghi chú</span>}</p>
            )}
          </div>
        </div>

        {/* Debt History */}
        {customer.debtBalance > 0 && (customer.orders ?? []).some((o: any) => o.debtAmount > 0) && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-red-400" />
              <h3 className="font-semibold text-slate-200">Lịch sử công nợ</h3>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>Mã đơn</th><th>Tổng tiền</th><th>Đã trả</th><th>Còn nợ</th><th>Ngày</th>
                </tr></thead>
                <tbody>
                  {(customer.orders ?? []).filter((o: any) => o.debtAmount > 0).map((o: any) => (
                    <tr key={o.id}>
                      <td><Link href={`/orders/${o.id}`} className="font-mono text-xs text-orange-400 hover:text-orange-300">{o.orderNo}</Link></td>
                      <td>{formatCurrency(o.totalAmount)}</td>
                      <td className="text-emerald-400">{formatCurrency(o.paidAmount)}</td>
                      <td className="font-semibold text-red-400">{formatCurrency(o.debtAmount)}</td>
                      <td className="text-xs text-slate-500">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Order history */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-slate-200">Đơn hàng gần đây</h3>
            </div>
            <Link href={`/orders/new?customer=${params.id}`} className="btn-primary text-sm">
              + Tạo đơn mới
            </Link>
          </div>
          {(customer.orders ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Chưa có đơn hàng nào</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>Mã đơn</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th>Ngày</th><th></th>
                </tr></thead>
                <tbody>
                  {customer.orders.map((o: any) => (
                    <tr key={o.id}>
                      <td><span className="font-mono text-xs text-orange-400">{o.orderNo}</span></td>
                      <td><div className="text-xs text-slate-400">{o.items?.map((i: any) => `${i.qty} ${i.product?.unit} ${i.product?.name}`).join(', ')}</div></td>
                      <td className="font-medium">{formatCurrency(o.totalAmount)}</td>
                      <td className="text-xs">{o.paymentMethod === 'cash' ? 'Tiền mặt' : o.paymentMethod === 'transfer' ? 'CK' : 'Công nợ'}</td>
                      <td>
                        {(o.status === 'completed' || o.status === 'delivered') && <span className="badge-green">Hoàn tất</span>}
                        {o.status === 'pending' && <span className="badge-yellow">Chờ xử lý</span>}
                      </td>
                      <td className="text-xs text-slate-500">{formatDate(o.createdAt)}</td>
                      <td><Link href={`/orders/${o.id}`} className="btn-ghost text-xs">Chi tiết →</Link></td>
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
