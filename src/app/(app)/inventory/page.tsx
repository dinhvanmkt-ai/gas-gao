'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { Package, AlertTriangle, Loader2, CircleDot, ClipboardCheck, History, X, TrendingDown, Edit3, Trash2, Save, Plus, Minus, Settings2 } from 'lucide-react'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils'

const CYLINDER_STATUS: Record<string, { label: string; cls: string }> = {
  at_store_full: { label: 'Tại kho đầy', cls: 'badge-green' },
  at_store_empty: { label: 'Tại kho rỗng', cls: 'badge-blue' },
  at_customer: { label: 'Tại khách hàng', cls: 'badge-yellow' },
  overdue: { label: 'Quá hạn thu hồi', cls: 'badge-red' },
}

const AUDIT_TYPE: Record<string, { label: string; cls: string }> = {
  in: { label: 'Nhập hàng', cls: 'text-emerald-400' },
  out: { label: 'Xuất đơn hàng', cls: 'text-red-400' },
  adjust: { label: 'Điều chỉnh', cls: 'text-yellow-400' },
}

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [cylinders, setCylinders] = useState<any[]>([])
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
  // Cylinder edit modal (status change)
  const [editCylinder, setEditCylinder] = useState<any>(null)
  const [cylEditSaving, setCylEditSaving] = useState(false)
  const [cylEditError, setCylEditError] = useState('')
  // Bulk adjust cylinders modal
  const [showBulkAdjust, setShowBulkAdjust] = useState(false)
  const [bulkMode, setBulkMode] = useState<'add' | 'remove'>('add')
  const [bulkType, setBulkType] = useState('')
  const [bulkStatus, setBulkStatus] = useState<'at_store_full' | 'at_store_empty'>('at_store_full')
  const [bulkQty, setBulkQty] = useState(1)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkSuccess, setBulkSuccess] = useState('')

  async function loadAll() {
    setLoading(true)
    try {
      const [p, c, a] = await Promise.all([
        fetch('/api/products').then(r => r.ok ? r.json() : []),
        fetch('/api/cylinders').then(r => r.ok ? r.json() : []),
        fetch('/api/stock-audits').then(r => r.ok ? r.json() : []),
      ])
      setProducts(Array.isArray(p) ? p : [])
      setCylinders(Array.isArray(c) ? c : [])
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
  const cylAtStoreFull = cylinders.filter(c => c.status === 'at_store_full').length
  const cylAtStoreEmpty = cylinders.filter(c => c.status === 'at_store_empty').length
  const cylAtCustomer = cylinders.filter(c => c.status === 'at_customer').length
  const cylOverdue = cylinders.filter(c => c.status === 'overdue').length

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

  // ---- Cylinder status edit ----
  function openCylEdit(c: any) {
    setEditCylinder({ ...c })
    setCylEditError('')
  }

  async function saveCylEdit() {
    if (!editCylinder) return
    setCylEditSaving(true)
    setCylEditError('')
    const res = await fetch(`/api/cylinders/${editCylinder.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serial: editCylinder.serial,
        type: editCylinder.type,
        weight: editCylinder.weight,
        capacity: editCylinder.capacity,
        brand: editCylinder.brand,
        status: editCylinder.status,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCylinders(prev => prev.map(c => c.id === updated.id ? updated : c))
      setEditCylinder(null)
    } else {
      const err = await res.json()
      setCylEditError(err.error || 'Lỗi khi lưu')
    }
    setCylEditSaving(false)
  }

  // ---- Bulk adjust cylinders ----
  function openBulkAdjust() {
    setBulkMode('add')
    setBulkType(gasProducts[0]?.name ?? '')
    setBulkStatus('at_store_full')
    setBulkQty(1)
    setBulkError('')
    setBulkSuccess('')
    setShowBulkAdjust(true)
  }

  async function submitBulkAdjust() {
    if (bulkQty <= 0) { setBulkError('Số lượng phải lớn hơn 0'); return }
    setBulkSaving(true)
    setBulkError('')
    setBulkSuccess('')

    if (bulkMode === 'add') {
      // Create multiple cylinders via POST in sequence
      let created = 0
      let errors = 0
      const prefix = `CYL-${bulkType.replace(/\s+/g, '-')}-`
      for (let i = 0; i < bulkQty; i++) {
        // Unique serial per cylinder: timestamp at creation time + random hex
        const serial = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const res = await fetch('/api/cylinders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, type: bulkType, status: bulkStatus }),
        })
        if (res.ok) created++
        else errors++
      }
      if (created === 0) {
        setBulkError('Không tạo được vỏ bình nào. Vui lòng thử lại.')
      } else {
        setBulkSuccess(`Đã thêm ${created} vỏ bình ${bulkType} (${CYLINDER_STATUS[bulkStatus]?.label})${errors > 0 ? ` · ${errors} lỗi` : ''}`)
        await loadAll()
      }
    } else {
      // Remove cylinders: delete the first N cylinders of given type+status at store
      const targets = cylinders
        .filter(c => c.type === bulkType && c.status === bulkStatus)
        .slice(0, bulkQty)
      if (targets.length === 0) {
        setBulkError(`Không có vỏ bình ${bulkType} với trạng thái "${CYLINDER_STATUS[bulkStatus]?.label}" để xóa`)
        setBulkSaving(false)
        return
      }
      if (targets.length < bulkQty) {
        setBulkError(`Chỉ có ${targets.length} vỏ phù hợp (yêu cầu ${bulkQty}). Sẽ xóa ${targets.length} vỏ.`)
      }
      let deleted = 0
      for (const t of targets) {
        const res = await fetch(`/api/cylinders/${t.id}`, { method: 'DELETE' })
        if (res.ok) deleted++
      }
      setBulkSuccess(`Đã xóa ${deleted} vỏ bình ${bulkType}`)
      await loadAll()
    }
    setBulkSaving(false)
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="card p-4 kpi-green"><p className="text-xs text-slate-500 mb-1">Tại kho đầy</p><p className="text-xl font-bold text-emerald-400">{cylAtStoreFull}</p></div>
                  <div className="card p-4 kpi-blue"><p className="text-xs text-slate-500 mb-1">Tại kho rỗng</p><p className="text-xl font-bold text-blue-400">{cylAtStoreEmpty}</p></div>
                  <div className="card p-4 kpi-yellow"><p className="text-xs text-slate-500 mb-1">Tại khách hàng</p><p className="text-xl font-bold text-yellow-400">{cylAtCustomer}</p></div>
                  <div className={`card p-4 ${cylOverdue > 0 ? 'kpi-red border-red-500/30' : 'kpi-green'}`}>
                    <p className="text-xs text-slate-500 mb-1">Quá hạn thu hồi</p>
                    <p className={`text-xl font-bold ${cylOverdue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{cylOverdue}</p>
                  </div>
                </div>

                {cylOverdue > 0 && (
                  <div className="card border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-300">Có {cylOverdue} bình quá hạn thu hồi</p>
                      <p className="text-xs text-red-400/70 mt-0.5">Cần liên hệ khách hàng để thu hồi vỏ bình</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-400">Tổng: <strong className="text-slate-200">{cylinders.length}</strong> vỏ bình</p>
                  <button onClick={openBulkAdjust} className="btn-secondary text-sm">
                    <Settings2 className="w-4 h-4" /> Điều chỉnh số lượng
                  </button>
                </div>

                <div className="table-wrap">
                  <table className="table">
                    <thead><tr>
                      <th>Mã bình</th><th>Sản phẩm</th><th>Trạng thái</th><th>Khách hàng</th><th>Số ngày giữ</th><th></th>
                    </tr></thead>
                    <tbody>
                      {cylinders.length === 0 ? (
                        <tr><td colSpan={6} className="text-center text-slate-500 py-8">
                          <CircleDot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          Chưa có vỏ bình nào trong hệ thống
                        </td></tr>
                      ) : (
                        cylinders.map((c) => {
                          const st = CYLINDER_STATUS[c.status] ?? { label: c.status, cls: 'badge-gray' }
                          const canEdit = c.status === 'at_store_full' || c.status === 'at_store_empty'
                          return (
                            <tr key={c.id}>
                              <td><span className="font-mono text-sm text-orange-400">{c.serial}</span></td>
                              <td><span className="text-slate-200 text-sm">{c.type}</span></td>
                              <td><span className={st.cls}>{st.label}</span></td>
                              <td>
                                {c.customer ? (
                                  <div>
                                    <p className="font-medium text-slate-200">{c.customer.name}</p>
                                    <p className="text-xs text-slate-500">{c.customer.phone}</p>
                                  </div>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              <td>
                                {c.daysAtCustomer !== null ? (
                                  <span className={`font-medium ${c.daysAtCustomer > 30 ? 'text-red-400' : c.daysAtCustomer > 14 ? 'text-yellow-400' : 'text-slate-300'}`}>
                                    {c.daysAtCustomer} ngày
                                  </span>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              <td>
                                {canEdit && (
                                  <button onClick={() => openCylEdit(c)}
                                    className="text-slate-400 hover:text-orange-400 p-1 rounded transition-colors" title="Sửa trạng thái">
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
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

      {/* ── Cylinder Status Edit Modal ── */}
      {editCylinder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] border border-slate-700/60 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-orange-400" /> Sửa Vỏ Bình
              </h3>
              <button onClick={() => setEditCylinder(null)} className="text-slate-500 hover:text-slate-300 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-500 mb-0.5">Mã bình</p>
                <p className="font-mono text-orange-400 font-medium">{editCylinder.serial}</p>
              </div>

              <div>
                <label className="label">Loại bình (sản phẩm gas)</label>
                <select value={editCylinder.type}
                  onChange={e => setEditCylinder((c: any) => ({ ...c, type: e.target.value }))}
                  className="input">
                  {/* Nếu type hiện tại không có trong danh sách gas products → hiển thị như option riêng */}
                  {editCylinder.type && !gasProducts.some((p: any) => p.name === editCylinder.type) && (
                    <option value={editCylinder.type}>{editCylinder.type} (dữ liệu cũ)</option>
                  )}
                  {gasProducts.map((p: any) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  {gasProducts.length === 0 && <option value="">Chưa có sản phẩm gas</option>}
                </select>
              </div>

              <div>
                <label className="label">Trạng thái</label>
                <div className="flex gap-3">
                  {[
                    { value: 'at_store_full', label: '🟢 Tại kho đầy' },
                    { value: 'at_store_empty', label: '🔵 Tại kho rỗng' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setEditCylinder((c: any) => ({ ...c, status: opt.value }))}
                      className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                        editCylinder.status === opt.value
                          ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {cylEditError && (
              <p className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{cylEditError}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={saveCylEdit} disabled={cylEditSaving}
                className="btn-primary flex-1 text-sm">
                {cylEditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu thay đổi
              </button>
              <button onClick={() => setEditCylinder(null)} className="btn-ghost text-sm">Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Adjust Cylinders Modal ── */}
      {showBulkAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] border border-slate-700/60 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-orange-400" /> Điều chỉnh Số lượng Vỏ Bình
              </h3>
              <button onClick={() => setShowBulkAdjust(false)} className="text-slate-500 hover:text-slate-300 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkSuccess ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-400">
                  ✅ {bulkSuccess}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setBulkSuccess(''); setBulkError('') }} className="btn-secondary flex-1 text-sm">Điều chỉnh tiếp</button>
                  <button onClick={() => setShowBulkAdjust(false)} className="btn-primary flex-1 text-sm">Đóng</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mode */}
                <div>
                  <label className="label">Thao tác</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setBulkMode('add')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                        bulkMode === 'add' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      <Plus className="w-4 h-4" /> Thêm vỏ bình
                    </button>
                    <button type="button" onClick={() => setBulkMode('remove')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                        bulkMode === 'remove' ? 'border-red-500 bg-red-500/10 text-red-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      <Minus className="w-4 h-4" /> Xóa vỏ bình
                    </button>
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="label">Loại bình (sản phẩm gas)</label>
                  <select value={bulkType} onChange={e => setBulkType(e.target.value)} className="input">
                    {gasProducts.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                    {gasProducts.length === 0 && <option value="">Chưa có sản phẩm gas</option>}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="label">Trạng thái</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setBulkStatus('at_store_full')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        bulkStatus === 'at_store_full' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      🟢 Tại kho đầy
                    </button>
                    <button type="button" onClick={() => setBulkStatus('at_store_empty')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        bulkStatus === 'at_store_empty' ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      🔵 Tại kho rỗng
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="label">Số lượng</label>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setBulkQty(q => Math.max(1, q - 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                    <input type="number" min={1} value={bulkQty}
                      onChange={e => setBulkQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="input flex-1 text-center text-lg font-bold" />
                    <button type="button" onClick={() => setBulkQty(q => q + 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className={`p-3 rounded-lg text-sm ${
                  bulkMode === 'add' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'
                }`}>
                  {bulkMode === 'add'
                    ? <>Sẽ <strong>thêm {bulkQty} vỏ bình {bulkType}</strong> vào kho với trạng thái <strong>{CYLINDER_STATUS[bulkStatus]?.label}</strong></>
                    : <>Sẽ <strong>xóa {bulkQty} vỏ bình {bulkType}</strong> có trạng thái <strong>{CYLINDER_STATUS[bulkStatus]?.label}</strong> khỏi hệ thống</>}
                </div>

                {bulkError && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{bulkError}</p>
                )}

                <div className="flex gap-2">
                  <button onClick={submitBulkAdjust} disabled={bulkSaving}
                    className={`flex-1 text-sm flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                      bulkMode === 'add' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}>
                    {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : bulkMode === 'add' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    {bulkSaving ? 'Đang xử lý...' : bulkMode === 'add' ? 'Thêm vỏ bình' : 'Xóa vỏ bình'}
                  </button>
                  <button onClick={() => setShowBulkAdjust(false)} className="btn-ghost text-sm">Hủy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
