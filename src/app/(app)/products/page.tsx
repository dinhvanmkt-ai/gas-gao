'use client'
import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/Header'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Loader2, X, AlertTriangle,
  Flame, Package, Wheat, TrendingUp, DollarSign
} from 'lucide-react'

interface Product {
  id: string
  name: string
  type: string
  unit: string
  priceRetail: number
  priceWhole: number | null
  costPrice: number | null
  stock: number
  minStock: number
}

const TYPE_OPTS = [
  { value: 'gas', label: 'Gas', icon: '🔥' },
  { value: 'rice', label: 'Gạo', icon: '🌾' },
  { value: 'other', label: 'Khác', icon: '📦' },
]

const UNIT_OPTS = ['bình', 'kg', 'bao', 'thùng', 'túi', 'hộp', 'cái']

const TABS = ['Tất cả', 'Gas 🔥', 'Gạo 🌾', 'Khác 📦']

function typeIcon(t: string) {
  if (t === 'gas') return <Flame className="w-3.5 h-3.5 text-orange-400" />
  if (t === 'rice') return <Wheat className="w-3.5 h-3.5 text-green-400" />
  return <Package className="w-3.5 h-3.5 text-blue-400" />
}

function typeLabel(t: string) {
  if (t === 'gas') return 'Gas'
  if (t === 'rice') return 'Gạo'
  return 'Khác'
}

function marginColor(margin: number) {
  if (margin >= 20) return 'text-emerald-400'
  if (margin >= 10) return 'text-yellow-400'
  if (margin > 0) return 'text-orange-400'
  return 'text-red-400'
}

const EMPTY_FORM = {
  name: '', type: 'gas', unit: 'bình',
  priceRetail: '', priceWhole: '', costPrice: '', minStock: '0',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Product | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM & { [k: string]: string }>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [customUnit, setCustomUnit] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/products')
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const tabFiltered = useMemo(() => {
    if (tab === 1) return products.filter(p => p.type === 'gas')
    if (tab === 2) return products.filter(p => p.type === 'rice')
    if (tab === 3) return products.filter(p => p.type === 'other')
    return products
  }, [products, tab])

  // KPI
  const gasCount = products.filter(p => p.type === 'gas').length
  const riceCount = products.filter(p => p.type === 'rice').length
  const noCostCount = products.filter(p => p.costPrice == null || p.costPrice === 0).length
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setCustomUnit('')
    setFormError('')
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditItem(p)
    setForm({
      name: p.name,
      type: p.type,
      unit: p.unit,
      priceRetail: String(p.priceRetail),
      priceWhole: p.priceWhole != null ? String(p.priceWhole) : '',
      costPrice: p.costPrice != null ? String(p.costPrice) : '',
      minStock: String(p.minStock),
    })
    setCustomUnit(UNIT_OPTS.includes(p.unit) ? '' : p.unit)
    setFormError('')
    setShowForm(true)
  }

  function getUnit() {
    return customUnit.trim() || form.unit
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Vui lòng nhập tên sản phẩm'); return }
    if (!form.priceRetail || Number(form.priceRetail) < 0) { setFormError('Giá bán lẻ không hợp lệ'); return }
    setSaving(true); setFormError('')
    const payload = {
      name: form.name.trim(),
      type: form.type,
      unit: getUnit(),
      priceRetail: Number(form.priceRetail) || 0,
      priceWhole: form.priceWhole !== '' ? Number(form.priceWhole) : null,
      costPrice: form.costPrice !== '' && Number(form.costPrice) > 0 ? Number(form.costPrice) : null,
      minStock: Number(form.minStock) || 0,
    }
    const url = editItem ? `/api/products/${editItem.id}` : '/api/products'
    const method = editItem ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) { setShowForm(false); await load() }
    else { const d = await res.json(); setFormError(d.error ?? 'Có lỗi xảy ra') }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(true); setDeleteError('')
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (res.ok) { setDeleteId(null); await load() }
    else { const d = await res.json(); setDeleteError(d.error ?? 'Không thể xóa') }
    setDeleting(false)
  }

  const profit = (p: Product) => {
    if (!p.costPrice || p.costPrice === 0) return null
    return p.priceRetail - p.costPrice
  }

  function profitColor(profit: number) {
    if (profit >= 50000) return 'text-emerald-400'
    if (profit >= 20000) return 'text-yellow-400'
    if (profit > 0) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Quản Lý Sản Phẩm" subtitle="Danh mục sản phẩm, giá bán, giá vốn" />
      <main className="flex-1 p-6 space-y-5">

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 kpi-orange">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Flame className="w-3 h-3" /> Gas</p>
            <p className="text-2xl font-bold text-orange-400">{gasCount}</p>
            <p className="text-xs text-slate-600 mt-0.5">sản phẩm</p>
          </div>
          <div className="card p-4 kpi-green">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Wheat className="w-3 h-3" /> Gạo</p>
            <p className="text-2xl font-bold text-emerald-400">{riceCount}</p>
            <p className="text-xs text-slate-600 mt-0.5">sản phẩm</p>
          </div>
          <div className={`card p-4 ${noCostCount > 0 ? 'kpi-red' : 'kpi-blue'}`}>
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Chưa có giá vốn</p>
            <p className={`text-2xl font-bold ${noCostCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>{noCostCount}</p>
            <p className="text-xs text-slate-600 mt-0.5">sản phẩm</p>
          </div>
          <div className={`card p-4 ${lowStockCount > 0 ? '' : ''}`}>
            <p className="text-xs text-slate-500 mb-1">Sắp hết hàng</p>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{lowStockCount}</p>
            <p className="text-xs text-slate-600 mt-0.5">sản phẩm</p>
          </div>
        </div>

        {/* No cost price warning */}
        {noCostCount > 0 && (
          <div className="card p-3 border-blue-500/30 bg-blue-500/5 flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-sm text-blue-200">
              <strong>{noCostCount} sản phẩm</strong> chưa có giá vốn →{' '}
              <span className="text-blue-400">Tab Lợi Nhuận trong Báo Cáo sẽ không tính được biên lợi nhuận</span>.
              Bấm ✏️ sửa để nhập giá vốn.
            </p>
          </div>
        )}

        {/* Main card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl">
              {TABS.map((t, i) => (
                <button key={t} onClick={() => setTab(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === i ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
              <Plus className="w-4 h-4" /> Thêm sản phẩm
            </button>
          </div>

          {deleteId && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm text-red-200">Xóa sản phẩm này?</p>
                  {deleteError && <p className="text-xs text-red-400 mt-0.5">{deleteError}</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1">
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Xác nhận
                </button>
                <button onClick={() => { setDeleteId(null); setDeleteError('') }} className="btn-ghost text-xs">Hủy</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
          ) : tabFiltered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Chưa có sản phẩm nào</p>
              <button onClick={openAdd} className="mt-3 text-orange-400 hover:text-orange-300 text-sm">+ Thêm sản phẩm</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Loại</th>
                    <th>Đ.vị</th>
                    <th className="text-right">Giá vốn</th>
                    <th className="text-right">Giá bán lẻ</th>
                    <th className="text-right">Giá sỉ</th>
                    <th className="text-right">Lợi Nhuận</th>
                    <th>Tồn kho</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {tabFiltered.map(p => {
                    const pf = profit(p)
                    const lowStock = p.stock <= p.minStock
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            {typeIcon(p.type)}
                            <span className="font-medium text-slate-200">{p.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            p.type === 'gas' ? 'bg-orange-500/15 text-orange-400' :
                            p.type === 'rice' ? 'bg-green-500/15 text-green-400' :
                            'bg-blue-500/15 text-blue-400'
                          }`}>{typeLabel(p.type)}</span>
                        </td>
                        <td className="text-slate-400 text-sm">{p.unit}</td>
                        <td className="text-right">
                          {p.costPrice
                            ? <span className="text-slate-300">{formatCurrency(p.costPrice)}</span>
                            : <span className="text-slate-600 text-xs italic">Chưa nhập</span>
                          }
                        </td>
                        <td className="text-right font-semibold text-emerald-400">{formatCurrency(p.priceRetail)}</td>
                        <td className="text-right text-slate-400">
                          {p.priceWhole ? formatCurrency(p.priceWhole) : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="text-right">
                          {pf != null
                            ? <span className={`font-semibold text-sm ${profitColor(pf)}`}>{formatCurrency(pf)}</span>
                            : <span className="text-slate-700 text-xs">—</span>
                          }
                        </td>
                        <td>
                          <span className={`font-medium text-sm ${lowStock ? 'text-red-400' : 'text-slate-300'}`}>
                            {p.stock} {p.unit}
                            {lowStock && <span className="ml-1 text-[10px] text-red-500">↓min</span>}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(p)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setDeleteId(p.id); setDeleteError('') }} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
          <div className="card w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200">{editItem ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>}

            <div className="space-y-3">
              {/* Tên */}
              <div>
                <label className="label">Tên sản phẩm <span className="text-red-400">*</span></label>
                <input autoFocus type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Gas 12kg, Gạo ST25 5kg..." className="input w-full" />
              </div>

              {/* Loại + Đơn vị */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Loại <span className="text-red-400">*</span></label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                    {TYPE_OPTS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Đơn vị bán</label>
                  <select value={customUnit ? '__custom__' : form.unit}
                    onChange={e => {
                      if (e.target.value === '__custom__') { setCustomUnit(''); }
                      else { setForm(f => ({ ...f, unit: e.target.value })); setCustomUnit('') }
                    }} className="input">
                    {UNIT_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
                    <option value="__custom__">Tùy chỉnh...</option>
                  </select>
                  {(customUnit !== '' || !UNIT_OPTS.includes(form.unit)) && (
                    <input type="text" value={customUnit} onChange={e => setCustomUnit(e.target.value)}
                      placeholder="Nhập đơn vị..." className="input mt-1 w-full text-sm" />
                  )}
                </div>
              </div>

              {/* Giá vốn */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                  Giá vốn / {getUnit() || form.unit}
                  <span className="text-slate-600 font-normal">(dùng cho báo cáo lợi nhuận)</span>
                </label>
                <input type="number" min={0} step={500} value={form.costPrice}
                  onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                  placeholder="0 = chưa nhập" className="input w-full" />
              </div>

              {/* Giá bán */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Giá bán lẻ <span className="text-red-400">*</span></label>
                  <input type="number" min={0} step={1000} value={form.priceRetail}
                    onChange={e => setForm(f => ({ ...f, priceRetail: e.target.value }))}
                    placeholder="0" className="input w-full" />
                </div>
                <div>
                  <label className="label">Giá bán sỉ</label>
                  <input type="number" min={0} step={1000} value={form.priceWhole}
                    onChange={e => setForm(f => ({ ...f, priceWhole: e.target.value }))}
                    placeholder="Tùy chọn" className="input w-full" />
                </div>
              </div>

              {/* Preview biên LN */}
              {form.costPrice && form.priceRetail && Number(form.priceRetail) > 0 && Number(form.costPrice) > 0 && (
                <div className="px-3 py-2 bg-slate-800/60 rounded-lg text-sm flex items-center justify-between">
                  <span className="text-slate-400">Biên lợi nhuận ước tính:</span>
                  <span className={`font-bold ${marginColor(((Number(form.priceRetail) - Number(form.costPrice)) / Number(form.priceRetail)) * 100)}`}>
                    {(((Number(form.priceRetail) - Number(form.costPrice)) / Number(form.priceRetail)) * 100).toFixed(1)}%
                    <span className="text-slate-400 font-normal ml-1">
                      ({formatCurrency(Number(form.priceRetail) - Number(form.costPrice))}/{getUnit() || form.unit})
                    </span>
                  </span>
                </div>
              )}

              {/* Tồn kho tối thiểu */}
              <div>
                <label className="label">Tồn kho tối thiểu (cảnh báo)</label>
                <input type="number" min={0} value={form.minStock}
                  onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))}
                  className="input w-full" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm transition-colors">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editItem ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
