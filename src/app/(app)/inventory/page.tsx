'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { Package, AlertTriangle, Loader2, ClipboardCheck, History, X, TrendingDown, Edit3, Trash2, Save, Plus, Minus } from 'lucide-react'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils'

const AUDIT_TYPE: Record<string, { label: string; cls: string }> = {
  in: { label: 'Nhập hàng', cls: 'text-emerald-400' },
  out: { label: 'Xuất đơn hàng', cls: 'text-red-400' },
  adjust: { label: 'Điều chỉnh', cls: 'text-yellow-400' },
}

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [cylTypes, setCylTypes] = useState<{id:string, name:string, fullQty:number, note?:string}[]>([])
  const [cylEmptyQty, setCylEmptyQty] = useState(0)
  const [cylLoading, setCylLoading] = useState(false)
  const [audits, setAudits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [showAudit, setShowAudit] = useState(false)
  const [auditItems, setAuditItems] = useState<{ productId: string; name: string; currentStock: number; actualQty: number | ''; reason: string }[]>([])
  const [auditSaving, setAuditSaving] = useState(false)
  const [auditResult, setAuditResult] = useState<any>(null)
  // Price history
  const [expandedPriceId, setExpandedPriceId] = useState<string | null>(null)
  const [priceHistory, setPriceHistory] = useState<Record<string, any[]>>({})
  // Product edit modal
  const [editProduct, setEditProduct] = useState<any>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  // Cylinder type management
  const [showAddType, setShowAddType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeQty, setNewTypeQty] = useState('0')
  const [addTypeError, setAddTypeError] = useState('')
  const [addTypeSaving, setAddTypeSaving] = useState(false)
  const [editTypeId, setEditTypeId] = useState<string|null>(null)
  const [editTypeQty, setEditTypeQty] = useState<string>('')

  async function loadAll() {
    setLoading(true)
    try {
      const [p, ct, a] = await Promise.all([
        fetch('/api/products').then(r => r.ok ? r.json() : []),
        fetch('/api/cylinder-types').then(r => r.ok ? r.json() : { types: [], emptyQty: 0 }),
        fetch('/api/stock-audits').then(r => r.ok ? r.json() : []),
      ])
      setProducts(Array.isArray(p) ? p : [])
      setCylTypes(Array.isArray(ct.types) ? ct.types : [])
      setCylEmptyQty(ct.emptyQty ?? 0)
      setAudits(Array.isArray(a) ? a : [])
    } catch (e) {
      console.error('Inventory load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const gasProducts = products.filter(p => p.type === 'gas')
  const riceProducts = products.filter(p => p.type === 'rice')
  const lowStock = products.filter(p => p.stock <= p.minStock)

  // Cylinder stats
  const totalFull = cylTypes.reduce((s, t) => s + t.fullQty, 0)

  const TABS = ['📦 Tồn Kho', '🔵 Vỏ Bình', '📋 Lịch sử']

  function openAuditModal() {
    setAuditItems(products.map(p => ({
      productId: p.id,
      name: p.name,
      currentStock: p.stock,
      actualQty: p.stock,
      reason: '',
    })))
    setAuditResult(null)
    setShowAudit(true)
  }

  async function togglePriceHistory(productId: string) {
    if (expandedPriceId === productId) { setExpandedPriceId(null); return }
    if (!priceHistory[productId]) {
      const res = await fetch(`/api/price-history?productId=${productId}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setPriceHistory(prev => ({ ...prev, [productId]: data }))
      }
    }
    setExpandedPriceId(productId)
  }

  function openEdit(p: any) {
    setEditProduct({ ...p })
    setEditError('')
    setDeleteConfirm(false)
    setDeleteError('')
  }

  async function saveEdit() {
    if (!editProduct) return
    setEditSaving(true)
    setEditError('')
    const res = await fetch(`/api/products/${editProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editProduct),
    })
    if (res.ok) {
      const updated = await res.json()
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
      setEditProduct(null)
    } else {
      const err = await res.json()
      setEditError(err.error || 'Lỗi khi lưu')
    }
    setEditSaving(false)
  }

  async function deleteProduct() {
    if (!editProduct) return
    setEditSaving(true)
    setDeleteError('')
    const res = await fetch(`/api/products/${editProduct.id}`, { method: 'DELETE' })
    if (res.ok) {
      setProducts(prev => prev.filter(p => p.id !== editProduct.id))
      setEditProduct(null)
    } else {
      const err = await res.json()
      setDeleteError(err.error || 'Không thể xóa sản phẩm')
      setDeleteConfirm(false)
    }
    setEditSaving(false)
  }

  // ---- New cylinder helper functions ----
  async function updateTypeQty(id: string, newQty: number) {
    const res = await fetch(`/api/cylinder-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullQty: newQty }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCylTypes(prev => prev.map(t => t.id === id ? { ...t, fullQty: updated.fullQty } : t))
    }
  }

  async function updateEmptyQty(delta: number) {
    const res = await fetch('/api/cylinder-empty', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCylEmptyQty(updated.qty)
    }
  }

  async function deleteType(id: string) {
    const res = await fetch(`/api/cylinder-types/${id}`, { method: 'DELETE' })
    if (res.ok) setCylTypes(prev => prev.filter(t => t.id !== id))
    else { const d = await res.json(); alert(d.error) }
  }

  async function addType() {
    if (!newTypeName.trim()) { setAddTypeError('Vui lòng nhập tên loại bình'); return }
    setAddTypeSaving(true); setAddTypeError('')
    const res = await fetch('/api/cylinder-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTypeName.trim(), fullQty: Number(newTypeQty) || 0 }),
    })
    if (res.ok) {
      const t = await res.json()
      setCylTypes(prev => [...prev, t])
      setNewTypeName(''); setNewTypeQty('0'); setShowAddType(false)
    } else {
      const d = await res.json(); setAddTypeError(d.error ?? 'Lỗi')
    }
    setAddTypeSaving(false)
  }

  async function submitAudit() {
    setAuditSaving(true)
    const items = auditItems
      .filter(i => i.actualQty !== '' && Number(i.actualQty) !== i.currentStock)
      .map(i => ({
        productId: i.productId,
        actualQty: Number(i.actualQty),
        reason: i.reason || undefined,
      }))

    if (items.length === 0) {
      setAuditResult({ adjusted: 0, results: [] })
      setAuditSaving(false)
      return
    }

    const res = await fetch('/api/stock-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const data = await res.json()
    setAuditResult(data)
    setAuditSaving(false)
    loadAll() // Refresh data
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Kho Hàng" subtitle="Theo dõi tồn kho và bình gas" />
      <main className="flex-1 p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Tổng sản phẩm</p><p className="text-xl font-bold">{products.length}</p></div>
          <div className="card p-4 kpi-orange"><p className="text-xs text-slate-500 mb-1">Gas ({gasProducts.length} loại)</p><p className="text-xl font-bold text-orange-400">{gasProducts.reduce((s, p) => s + p.stock, 0)} bình</p></div>
          <div className="card p-4 kpi-blue"><p className="text-xs text-slate-500 mb-1">Gạo ({riceProducts.length} loại)</p><p className="text-xl font-bold text-blue-400">{riceProducts.reduce((s, p) => s + p.stock, 0)} kg</p></div>
          <div className={`card p-4 ${lowStock.length > 0 ? 'kpi-red border-red-500/30' : 'kpi-green'}`}>
            <p className="text-xs text-slate-500 mb-1">Sắp hết hàng</p>
            <p className={`text-xl font-bold ${lowStock.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{lowStock.length} SP</p>
          </div>
        </div>

        {lowStock.length > 0 && (
          <div className="card border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">Cần nhập hàng</p>
              <p className="text-xs text-red-400/70 mt-0.5">{lowStock.map(p => p.name).join(', ')} sắp hết tồn kho</p>
            </div>
          </div>
        )}

        {/* Tabs + Kiểm kê button */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === i ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >{t}</button>
            ))}
          </div>
          <button onClick={openAuditModal} className="btn-secondary text-sm">
            <ClipboardCheck className="w-4 h-4" /> Kiểm kê
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
        ) : (
          <>
            {/* Tab 0: Tồn kho */}
            {tab === 0 && (
              <div className="space-y-6">
                {[{ label: '🔥 Gas', items: gasProducts }, { label: '🌾 Gạo', items: riceProducts }].map(({ label, items }) => (
                  <div key={label}>
                    <h3 className="text-sm font-semibold text-slate-400 mb-3">{label}</h3>
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr>
                          <th>Tên sản phẩm</th><th>Đơn vị</th><th>Tồn kho</th><th>Tồn tối thiểu</th><th>Giá lẻ</th><th>Giá sỉ</th><th>Trạng thái</th><th></th>
                        </tr></thead>
                        <tbody>
                          {items.map((p) => (
                            <>
                              <tr key={p.id}>
                                <td className="font-medium">{p.name}</td>
                                <td>{p.unit}</td>
                                <td>
                                  <span className={p.stock <= p.minStock ? 'text-red-400 font-bold' : 'text-slate-200 font-medium'}>{p.stock}</span>
                                </td>
                                <td className="text-slate-500">{p.minStock}</td>
                                <td>{formatCurrency(p.priceRetail)}</td>
                                <td>{p.priceWhole ? formatCurrency(p.priceWhole) : '—'}</td>
                                <td>
                                  {p.stock <= p.minStock
                                    ? <span className="badge-red">Sắp hết</span>
                                    : p.stock <= p.minStock * 2
                                      ? <span className="badge-yellow">Ít hàng</span>
                                      : <span className="badge-green">Đủ hàng</span>
                                  }
                                </td>
                                <td>
                                  <button onClick={() => togglePriceHistory(p.id)}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3" />
                                    {expandedPriceId === p.id ? 'Ẩn' : 'Giá nhập'}
                                  </button>
                                </td>
                                <td>
                                  <button onClick={() => openEdit(p)}
                                    className="text-slate-400 hover:text-orange-400 p-1 rounded transition-colors" title="Sửa sản phẩm">
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                              {expandedPriceId === p.id && priceHistory[p.id] && (
                                <tr className="bg-slate-800/50">
                                  <td colSpan={8} className="py-2 px-4">
                                    <div className="text-xs text-slate-400 font-medium mb-1">Lịch sử giá nhập:</div>
                                    {priceHistory[p.id].length > 0 ? (
                                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {priceHistory[p.id].map((entry, i) => (
                                          <span key={i} className="text-slate-300">
                                            {formatCurrency(entry.price)} <span className="text-slate-500">({formatDate(entry.date)})</span>
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-500">Chưa có lịch sử giá nhập</span>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </>
                          ))}
                          {items.length === 0 && (
                            <tr><td colSpan={8} className="text-center text-slate-500 py-8">Không có sản phẩm</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 1: Vỏ Bình */}
            {tab === 1 && (
              <div className="space-y-5">
                {/* KPI */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-5 kpi-green">
                    <p className="text-xs text-slate-500 mb-1">Tổng bình đầy tại kho</p>
                    <p className="text-3xl font-bold text-emerald-400">{totalFull}</p>
                    <p className="text-xs text-slate-600 mt-1">bình</p>
                  </div>
                  <div className="card p-5 kpi-blue">
                    <p className="text-xs text-slate-500 mb-1">Tổng bình rỗng tại kho</p>
                    <p className="text-3xl font-bold text-blue-400">{cylEmptyQty}</p>
                    <p className="text-xs text-slate-600 mt-1">bình</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {/* Bình đầy theo loại */}
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-200">🟢 Bình đầy — theo loại</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Nhập từ NCC theo loại bình</p>
                      </div>
                      <button onClick={() => setShowAddType(true)} className="btn-secondary text-xs flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Thêm loại
                      </button>
                    </div>

                    {showAddType && (
                      <div className="mb-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                        <p className="text-sm font-medium text-slate-200">Thêm loại bình mới</p>
                        {addTypeError && <p className="text-xs text-red-400">{addTypeError}</p>}
                        <div className="flex gap-2">
                          <input type="text" value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                            placeholder="Tên loại (VD: Gas 12kg)" className="input flex-1 text-sm py-1.5" />
                          <input type="number" min={0} value={newTypeQty} onChange={e => setNewTypeQty(e.target.value)}
                            placeholder="SL" className="input w-20 text-sm py-1.5 text-center" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={addType} disabled={addTypeSaving}
                            className="btn-primary text-xs py-1.5 flex items-center gap-1">
                            {addTypeSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Thêm
                          </button>
                          <button onClick={() => { setShowAddType(false); setAddTypeError('') }} className="btn-ghost text-xs">Hủy</button>
                        </div>
                      </div>
                    )}

                    {cylTypes.length === 0 ? (
                      <p className="text-slate-500 text-center py-8 text-sm">Chưa có loại bình nào</p>
                    ) : (
                      <div className="space-y-3">
                        {cylTypes.map(t => (
                          <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl">
                            <div className="flex-1">
                              <p className="font-medium text-slate-200">{t.name}</p>
                              {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                            </div>
                            {editTypeId === t.id ? (
                              <div className="flex items-center gap-2">
                                <input type="number" min={0} value={editTypeQty}
                                  onChange={e => setEditTypeQty(e.target.value)}
                                  className="input w-20 py-1 text-center text-sm" />
                                <button onClick={async () => {
                                  await updateTypeQty(t.id, Number(editTypeQty))
                                  setEditTypeId(null)
                                }} className="btn-primary text-xs py-1.5">Lưu</button>
                                <button onClick={() => setEditTypeId(null)} className="btn-ghost text-xs">Hủy</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold text-emerald-400">{t.fullQty}</span>
                                <span className="text-xs text-slate-500">bình</span>
                                <div className="flex gap-1">
                                  <button onClick={() => updateTypeQty(t.id, Math.max(0, t.fullQty - 1))}
                                    className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors">
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => updateTypeQty(t.id, t.fullQty + 1)}
                                    className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors">
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => { setEditTypeId(t.id); setEditTypeQty(String(t.fullQty)) }}
                                    className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors">
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  {t.fullQty === 0 && (
                                    <button onClick={() => deleteType(t.id)}
                                      className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-sm text-slate-400">Tổng bình đầy:</span>
                      <span className="text-xl font-bold text-emerald-400">{totalFull} bình</span>
                    </div>
                  </div>

                  {/* Bình rỗng */}
                  <div className="card p-5">
                    <div className="mb-4">
                      <h3 className="font-semibold text-slate-200">⚪ Bình rỗng — tổng kho</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Thu về từ khách khi đổi bình (không phân loại)</p>
                    </div>
                    <div className="flex flex-col items-center justify-center py-8 gap-4">
                      <p className="text-6xl font-bold text-blue-400">{cylEmptyQty}</p>
                      <p className="text-slate-400">bình rỗng</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateEmptyQty(-1)} disabled={cylEmptyQty <= 0}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 disabled:opacity-30 transition-colors border border-slate-700">
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="text-slate-600 text-2xl font-light">|</span>
                        <button onClick={() => updateEmptyQty(1)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors border border-slate-700">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">Bấm +/- để điều chỉnh theo thực tế đếm được</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Lịch sử */}
            {tab === 2 && (
              <div className="table-wrap">
                {audits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <History className="w-10 h-10 mb-3 opacity-30" />
                    <p>Chưa có lịch sử thay đổi tồn kho</p>
                  </div>
                ) : (
                  <table className="table">
                    <thead><tr>
                      <th>Thời gian</th><th>Sản phẩm</th><th>Loại</th><th>Số lượng</th><th>Trước</th><th>Sau</th><th>Lý do</th>
                    </tr></thead>
                    <tbody>
                      {audits.map(a => {
                        const t = AUDIT_TYPE[a.type] ?? { label: a.type, cls: 'text-slate-400' }
                        return (
                          <tr key={a.id}>
                            <td className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</td>
                            <td className="font-medium">{a.product?.name ?? '—'}</td>
                            <td><span className={`text-xs font-medium ${t.cls}`}>{t.label}</span></td>
                            <td>
                              <span className={a.type === 'in' ? 'text-emerald-400' : a.type === 'out' ? 'text-red-400' : 'text-yellow-400'}>
                                {a.type === 'in' ? '+' : a.type === 'out' ? '-' : '~'}{a.qty}
                              </span>
                            </td>
                            <td className="text-slate-500">{a.beforeQty}</td>
                            <td className="text-slate-500">{a.afterQty}</td>
                            <td className="text-xs text-slate-400">{a.reason ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}

        {/* Kiểm kê Modal */}
        {showAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-200">📋 Kiểm kê tồn kho</h2>
                <button onClick={() => setShowAudit(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
              </div>

              {auditResult ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-sm font-medium text-emerald-400">
                      ✅ Đã điều chỉnh {auditResult.adjusted} sản phẩm
                    </p>
                  </div>
                  {auditResult.results?.length > 0 && (
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr><th>Sản phẩm</th><th>Sổ sách</th><th>Thực tế</th><th>Chênh lệch</th></tr></thead>
                        <tbody>
                          {auditResult.results.map((r: any) => (
                            <tr key={r.productId}>
                              <td className="font-medium">{r.name}</td>
                              <td>{r.before}</td>
                              <td>{r.after}</td>
                              <td className={r.diff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {r.diff > 0 ? '+' : ''}{r.diff}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <button onClick={() => setShowAudit(false)} className="btn-primary w-full">Đóng</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">Nhập số lượng thực tế cho từng sản phẩm. Chỉ các sản phẩm khác sổ sách sẽ được điều chỉnh.</p>
                  <div className="space-y-3">
                    {auditItems.map((item, idx) => (
                      <div key={item.productId} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-200">{item.name}</p>
                          <p className="text-xs text-slate-500">Sổ sách: {item.currentStock}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={item.actualQty}
                            onChange={e => {
                              const newItems = [...auditItems]
                              newItems[idx].actualQty = e.target.value === '' ? '' : Number(e.target.value)
                              setAuditItems(newItems)
                            }}
                            className="input w-20 py-1 text-center"
                            placeholder="Thực tế"
                          />
                          {Number(item.actualQty) !== item.currentStock && item.actualQty !== '' && (
                            <input
                              type="text"
                              value={item.reason}
                              onChange={e => {
                                const newItems = [...auditItems]
                                newItems[idx].reason = e.target.value
                                setAuditItems(newItems)
                              }}
                              className="input w-36 py-1 text-xs"
                              placeholder="Lý do..."
                            />
                          )}
                          {Number(item.actualQty) !== item.currentStock && item.actualQty !== '' && (
                            <span className={`text-xs font-bold ${Number(item.actualQty) > item.currentStock ? 'text-emerald-400' : 'text-red-400'}`}>
                              {Number(item.actualQty) > item.currentStock ? '+' : ''}{Number(item.actualQty) - item.currentStock}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={submitAudit} disabled={auditSaving} className="btn-primary flex-1">
                      {auditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                      {auditSaving ? 'Đang xử lý...' : 'Xác nhận kiểm kê'}
                    </button>
                    <button onClick={() => setShowAudit(false)} className="btn-ghost">Hủy</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Product Edit Modal ── */}

      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] border border-slate-700/60 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-orange-400" /> Chỉnh sửa sản phẩm
              </h3>
              <button onClick={() => setEditProduct(null)} className="text-slate-500 hover:text-slate-300 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Tên sản phẩm *</label>
                <input value={editProduct.name}
                  onChange={e => setEditProduct((p: any) => ({ ...p, name: e.target.value }))}
                  className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Loại</label>
                  <select value={editProduct.type}
                    onChange={e => setEditProduct((p: any) => ({ ...p, type: e.target.value }))}
                    className="input">
                    <option value="gas">Gas</option>
                    <option value="rice">Gạo</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="label">Đơn vị</label>
                  <input value={editProduct.unit}
                    onChange={e => setEditProduct((p: any) => ({ ...p, unit: e.target.value }))}
                    className="input" placeholder="bình / kg / thùng" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Giá bán lẻ (đ)</label>
                  <input type="number" min={0} step={1000} value={editProduct.priceRetail ?? ''}
                    onChange={e => setEditProduct((p: any) => ({ ...p, priceRetail: Number(e.target.value) || 0 }))}
                    className="input" />
                </div>
                <div>
                  <label className="label">Giá bán sỉ (đ)</label>
                  <input type="number" min={0} step={1000} value={editProduct.priceWhole ?? ''}
                    onChange={e => setEditProduct((p: any) => ({ ...p, priceWhole: Number(e.target.value) || 0 }))}
                    className="input" placeholder="—" />
                </div>
              </div>
              <div>
                <label className="label">Tồn kho tối thiểu (ngưỡng cảnh báo)</label>
                <input type="number" min={0} step={1} value={editProduct.minStock ?? 0}
                  onChange={e => setEditProduct((p: any) => ({ ...p, minStock: Number(e.target.value) || 0 }))}
                  className="input" />
              </div>
              <div className="pt-1 border-t border-slate-700/50 text-xs text-slate-500">
                Tồn kho hiện tại: <span className="text-slate-300 font-medium">{editProduct.stock} {editProduct.unit}</span>
                <span className="ml-2 text-slate-600">(chỉnh qua chức năng Kiểm kê)</span>
              </div>
            </div>

            {editError && (
              <p className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{editError}</p>
            )}

            {/* Delete confirm */}
            {deleteConfirm ? (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-300 mb-2">⚠️ Xác nhận xóa sản phẩm <strong>{editProduct.name}</strong>?</p>
                {deleteError && <p className="text-xs text-red-400 mb-2">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={deleteProduct} disabled={editSaving}
                    className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium flex items-center gap-1.5 transition-colors">
                    {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Xóa vĩnh viễn
                  </button>
                  <button onClick={() => setDeleteConfirm(false)} className="btn-ghost text-sm">Hủy</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between mt-5">
                <button onClick={() => setDeleteConfirm(true)}
                  className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1.5 transition-colors">
                  <Trash2 className="w-4 h-4" /> Xóa sản phẩm
                </button>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={editSaving || !editProduct.name.trim()}
                    className="btn-primary text-sm">
                    {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Lưu thay đổi
                  </button>
                  <button onClick={() => setEditProduct(null)} className="btn-ghost text-sm">Hủy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
