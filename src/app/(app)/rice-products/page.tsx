'use client'
import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { formatCurrency } from '@/lib/utils'
import { Plus, Pencil, Trash2, Loader2, Wheat, X, Eye, EyeOff, AlertTriangle } from 'lucide-react'

interface RiceProduct {
  id: string
  name: string
  description: string | null
  lastPricePerKg: number | null
  active: boolean
  purchaseItems: { totalKg: number; subtotal: number }[]
  _count: { purchaseItems: number }
}

export default function RiceProductsPage() {
  const [products, setProducts] = useState<RiceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<RiceProduct | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/rice-products')
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const displayed = useMemo(() =>
    showInactive ? products : products.filter(p => p.active),
    [products, showInactive]
  )

  function openAdd() {
    setEditItem(null)
    setForm({ name: '', description: '' })
    setError('')
    setShowForm(true)
  }

  function openEdit(p: RiceProduct) {
    setEditItem(p)
    setForm({ name: p.name, description: p.description ?? '' })
    setError('')
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Vui lòng nhập tên loại gạo'); return }
    setSaving(true); setError('')
    const url = editItem ? `/api/rice-products/${editItem.id}` : '/api/rice-products'
    const method = editItem ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) { setShowForm(false); await load() }
    else { const d = await res.json(); setError(d.error ?? 'Có lỗi xảy ra') }
    setSaving(false)
  }

  async function toggleActive(p: RiceProduct) {
    await fetch(`/api/rice-products/${p.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    })
    await load()
  }

  async function handleDelete(id: string) {
    setDeleting(true); setDeleteError('')
    const res = await fetch(`/api/rice-products/${id}`, { method: 'DELETE' })
    if (res.ok) { setDeleteId(null); await load() }
    else { const d = await res.json(); setDeleteError(d.error ?? 'Không thể xóa') }
    setDeleting(false)
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Danh Mục Gạo Nhập" subtitle="Quản lý các loại gạo cửa hàng nhập về" />
      <main className="flex-1 p-6 space-y-5">

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 kpi-green">
            <p className="text-xs text-slate-500 mb-1">Loại gạo</p>
            <p className="text-2xl font-bold text-emerald-400">{products.filter(p => p.active).length}</p>
            <p className="text-xs text-slate-600 mt-0.5">đang dùng</p>
          </div>
          <div className="card p-4 kpi-blue">
            <p className="text-xs text-slate-500 mb-1">Tổng lần nhập</p>
            <p className="text-2xl font-bold text-blue-400">{products.reduce((s, p) => s + p._count.purchaseItems, 0)}</p>
          </div>
          <div className="card p-4 kpi-orange">
            <p className="text-xs text-slate-500 mb-1">Tổng kg đã nhập</p>
            <p className="text-xl font-bold text-orange-400">
              {products.reduce((s, p) => s + p.purchaseItems.reduce((ss, i) => ss + i.totalKg, 0), 0).toLocaleString('vi-VN')} kg
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500 mb-1">Tổng chi nhập</p>
            <p className="text-xl font-bold text-slate-200">
              {formatCurrency(products.reduce((s, p) => s + p.purchaseItems.reduce((ss, i) => ss + i.subtotal, 0), 0))}
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Wheat className="w-4 h-4 text-green-400" /> Danh sách loại gạo
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowInactive(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${showInactive ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-800/60 text-slate-500 border-slate-700 hover:border-slate-600'}`}>
                {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {showInactive ? 'Ẩn đã ngừng' : 'Hiện đã ngừng'}
              </button>
              <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
                <Plus className="w-4 h-4" /> Thêm loại gạo
              </button>
            </div>
          </div>

          {deleteId && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm text-red-200">Xóa loại gạo này?</p>
                  {deleteError && <p className="text-xs text-red-400 mt-0.5">{deleteError}</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1 transition-colors">
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Xác nhận
                </button>
                <button onClick={() => { setDeleteId(null); setDeleteError('') }} className="btn-ghost text-xs">Hủy</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-green-500" /></div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Wheat className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Chưa có loại gạo nào</p>
              <button onClick={openAdd} className="mt-3 text-green-400 hover:text-green-300 text-sm">+ Thêm loại gạo đầu tiên</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Loại gạo</th>
                    <th>Mô tả</th>
                    <th>Giá nhập gần nhất</th>
                    <th>Số lần nhập</th>
                    <th>Tổng kg đã nhập</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(p => {
                    const totalKg = p.purchaseItems.reduce((s, i) => s + i.totalKg, 0)
                    return (
                      <tr key={p.id} className={!p.active ? 'opacity-50' : ''}>
                        <td className="font-semibold text-emerald-400">{p.name}</td>
                        <td className="text-slate-400 text-sm">{p.description ?? '—'}</td>
                        <td>{p.lastPricePerKg ? <span className="font-medium">{formatCurrency(p.lastPricePerKg)}<span className="text-slate-500 text-xs">/kg</span></span> : <span className="text-slate-600">Chưa có</span>}</td>
                        <td>{p._count.purchaseItems} lần</td>
                        <td>{totalKg > 0 ? `${totalKg.toLocaleString('vi-VN')} kg` : '—'}</td>
                        <td>
                          <span className={p.active ? 'badge-green' : 'badge-gray'}>
                            {p.active ? 'Đang dùng' : 'Đã ngừng'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(p)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => toggleActive(p)} className="p-1.5 text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors" title={p.active ? 'Ẩn' : 'Hiện lại'}>
                              {p.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            {p._count.purchaseItems === 0 && (
                              <button onClick={() => { setDeleteId(p.id); setDeleteError('') }} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200">{editItem ? 'Sửa loại gạo' : 'Thêm loại gạo'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tên loại gạo <span className="text-red-400">*</span></label>
                <input autoFocus type="text" placeholder="VD: Gạo ST25, Jasmine, Bắc Hương..." value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Mô tả / Nguồn gốc</label>
                <input type="text" placeholder="VD: Sóc Trăng, Thái Lan..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input w-full" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm transition-colors">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editItem ? 'Lưu thay đổi' : 'Thêm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
