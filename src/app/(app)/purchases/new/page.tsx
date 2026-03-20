'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, Truck, Plus, Trash2,
  UserPlus, Package, X, CheckCircle, FileText, Calendar
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PurchaseItem {
  productId: string
  productName: string
  unit: string
  qty: number
  unitCost: number   // last known cost
}

interface NewProduct {
  name: string; type: string; unit: string
  priceRetail: number; priceWhole: number; minStock: number
}

export default function NewPurchasePage() {
  const router = useRouter()

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'owe'>('paid')
  
  // Cylinder transaction
  const [cylinderTxType, setCylinderTxType] = useState<'' | 'exchange' | 'buy'>('')
  const [cylinderQty, setCylinderQty] = useState<number>(0)

  // New supplier inline
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', type: 'gas' })
  const [creatingSupplier, setCreatingSupplier] = useState(false)

  // New product modal
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: '', type: 'gas', unit: 'bình', priceRetail: 0, priceWhole: 0, minStock: 0
  })
  const [creatingProduct, setCreatingProduct] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
    ]).then(([s, p]) => {
      setSuppliers(Array.isArray(s) ? s : [])
      setProducts(Array.isArray(p) ? p : [])
    })
  }, [])

  // Get last import price for a product
  async function getLastCost(productId: string): Promise<number | null> {
    const res = await fetch(`/api/price-history?productId=${productId}&limit=1`)
    if (!res.ok) return null
    const data = await res.json()
    return data[0]?.unitCost ?? null
  }

  async function createSupplier() {
    if (!newSupplier.name.trim()) return
    setCreatingSupplier(true)
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSupplier),
    })
    if (res.ok) {
      const s = await res.json()
      setSuppliers([...suppliers, s])
      setSupplierId(s.id)
      setShowNewSupplier(false)
      setNewSupplier({ name: '', phone: '', type: 'gas' })
    }
    setCreatingSupplier(false)
  }

  async function createProduct() {
    if (!newProduct.name.trim()) return
    setCreatingProduct(true)
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    })
    if (res.ok) {
      const p = await res.json()
      setProducts(prev => [...prev, p])
      // Auto-add to items
      setItems(prev => [...prev, {
        productId: p.id,
        productName: p.name,
        unit: p.unit,
        qty: 1,
        unitCost: p.priceWhole ?? Math.round(p.priceRetail * 0.8),
      }])
      setShowNewProduct(false)
      setNewProduct({ name: '', type: 'gas', unit: 'bình', priceRetail: 0, priceWhole: 0, minStock: 0 })
    }
    setCreatingProduct(false)
  }

  async function addItem(product: any) {
    if (items.find(i => i.productId === product.id)) return
    const lastCost = await getLastCost(product.id)
    const newItem = {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      qty: 1,
      unitCost: lastCost ?? product.priceWhole ?? Math.round(product.priceRetail * 0.8),
    }
    setItems(prev => {
      const updated = [...prev, newItem]
      // Auto-select cylinder mode khi thêm sản phẩm gas
      if (product.type === 'gas' && !prev.some(i => products.find(p => p.id === i.productId)?.type === 'gas')) {
        // Lần đầu thêm gas → mặc định 'buy'
        setCylinderTxType('buy')
      }
      // Auto-update cylinderQty
      if (product.type === 'gas') {
        const newGasTotal = updated
          .filter(i => products.find(p => p.id === i.productId)?.type === 'gas')
          .reduce((s, i) => s + Math.ceil(i.qty), 0) + 1 // +1 for this new item qty=1
        // Cảnh báo: nếu cylinderTxType được chọn, auto-suggest qty
        setCylinderQty(q => q === 0 ? 1 : q)
      }
      return updated
    })
  }

  function updateItem(idx: number, field: string, value: number) {
    const newItems = [...items]
    ;(newItems[idx] as any)[field] = value
    setItems(newItems)
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  const totalAmount = items.reduce((s, i) => s + i.qty * i.unitCost, 0)
  const hasGasItem = items.some(i => products.find(p => p.id === i.productId)?.type === 'gas')
  // Tổng số bình gas nhập
  const gasQtyTotal = items
    .filter(i => products.find(p => p.id === i.productId)?.type === 'gas')
    .reduce((s, i) => s + Math.ceil(i.qty), 0)

  async function handleSubmit(action: 'draft' | 'confirm') {
    setError('')
    if (!supplierId) { setError('Vui lòng chọn nhà cung cấp'); return }
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 sản phẩm'); return }

    setSaving(true)
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId, note, purchaseDate, paymentStatus, action,
        cylinderTxType: hasGasItem ? cylinderTxType : '',
        cylinderQty: hasGasItem && cylinderTxType ? cylinderQty : 0,
        items: items.map(i => ({
          productId: i.productId,
          qty: i.qty,
          unitCost: i.unitCost,
        })),
      }),
    })

    if (res.ok) {
      router.push('/purchases')
    } else {
      const err = await res.json()
      setError(err.error || 'Có lỗi xảy ra')
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Phiếu Nhập Hàng" subtitle="Tạo phiếu nhập hàng mới" />

      <main className="flex-1 p-6">
        <div className="mb-5">
          <Link href="/purchases" className="btn-ghost text-sm">
            <ArrowLeft className="w-4 h-4" /> Danh sách nhập hàng
          </Link>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* ── Supplier + Date ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-400" /> Thông tin phiếu nhập
              </h3>
              <button type="button" onClick={() => setShowNewSupplier(!showNewSupplier)} className="btn-ghost text-xs">
                <UserPlus className="w-3.5 h-3.5" /> Tạo NCC mới
              </button>
            </div>

            {showNewSupplier && (
              <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className="label">Tên NCC *</label><input value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} className="input" placeholder="Tên NCC" /></div>
                  <div><label className="label">SĐT</label><input value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} className="input" placeholder="0912..." /></div>
                  <div><label className="label">Loại</label>
                    <select value={newSupplier.type} onChange={e => setNewSupplier({ ...newSupplier, type: e.target.value })} className="input">
                      <option value="gas">Gas</option><option value="rice">Gạo</option><option value="other">Khác</option>
                    </select>
                  </div>
                </div>
                <button type="button" onClick={createSupplier} disabled={creatingSupplier} className="btn-primary text-sm">
                  {creatingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tạo NCC
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nhà cung cấp *</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="input">
                  <option value="">— Chọn NCC —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Ngày nhập</label>
                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="input" />
              </div>
            </div>
          </div>

          {/* ── Products ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" /> Hàng hóa nhập
              </h3>
              <button type="button" onClick={() => setShowNewProduct(true)} className="btn-ghost text-xs">
                <Plus className="w-3.5 h-3.5" /> Thêm sản phẩm mới
              </button>
            </div>

            {/* Product selector tags */}
            <div className="flex flex-wrap gap-2 mb-5">
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p)}
                  disabled={items.some(i => i.productId === p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    items.some(i => i.productId === p.id)
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-default'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-blue-500/50 hover:text-blue-300'
                  }`}
                >
                  <Plus className="w-3 h-3 inline mr-1" />{p.name}
                  <span className="ml-1 text-slate-500">({p.unit})</span>
                </button>
              ))}
            </div>

            {/* Items table */}
            {items.length > 0 ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>Sản phẩm</th>
                    <th className="text-center w-28">Số lượng nhập</th>
                    <th className="text-right w-36">Đơn giá nhập (đ)</th>
                    <th className="text-right">Thành tiền</th>
                    <th className="w-10"></th>
                  </tr></thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.productId}>
                        <td className="font-medium">
                          {item.productName}
                          <span className="text-slate-500 text-xs ml-1">/{item.unit}</span>
                        </td>
                        <td>
                          <input
                            type="number" min={0.1} step={0.1} value={item.qty}
                            onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                            className="input w-24 py-1 text-center"
                          />
                        </td>
                        <td>
                          <input
                            type="number" min={0} step={1000} value={item.unitCost}
                            onChange={e => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                            className="input w-32 py-1 text-right"
                          />
                        </td>
                        <td className="text-right font-semibold text-blue-400">
                          {formatCurrency(item.qty * item.unitCost)}
                        </td>
                        <td>
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-800/50">
                      <td colSpan={3} className="text-right font-semibold text-slate-300">Tổng chi phiếu nhập</td>
                      <td className="text-right font-bold text-lg text-blue-400">{formatCurrency(totalAmount)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                Chọn sản phẩm ở trên để thêm vào phiếu nhập
              </div>
            )}
          </div>

          {/* ── Cylinder Transaction ── */}
          {hasGasItem && (
            <div className="card p-5 border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold text-blue-100 text-sm">Vỏ bình gas</h3>
                </div>
                <span className="text-xs text-slate-400">
                  Tự động lấy số lượng từ sản phẩm: <strong className="text-blue-300">{gasQtyTotal} bình</strong>
                </span>
              </div>

              <div className="flex gap-2">
                {[
                  { value: 'buy', label: '🆕 Mua vỏ mới', desc: 'Tạo bình đầy mới vào kho' },
                  { value: 'exchange', label: '🔄 Đổi vỏ rỗng → đầy', desc: 'Xuất vỏ rỗng, nhận bình đầy từ NCC' },
                  { value: '', label: 'Bỏ qua', desc: 'Không cập nhật vỏ bình' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setCylinderTxType(opt.value as any)
                      setCylinderQty(opt.value ? gasQtyTotal : 0)
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-medium border transition-all text-left ${
                      cylinderTxType === opt.value
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-slate-500 mt-0.5 font-normal">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Payment & Note ── */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" /> Thanh toán & Ghi chú
            </h3>

            <div>
              <label className="label">Trạng thái thanh toán NCC</label>
              <div className="flex gap-3 mt-1">
                {[
                  { value: 'paid', label: '✅ Đã trả NCC', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
                  { value: 'owe', label: '⏳ Còn nợ NCC', cls: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentStatus(opt.value as any)}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                      paymentStatus === opt.value
                        ? opt.cls
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Ghi chú</label>
              <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="Ghi chú cho phiếu nhập..." />
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleSubmit('confirm')}
              disabled={saving || items.length === 0}
              className="btn-primary py-3 px-6 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Xác nhận nhập kho{totalAmount > 0 ? ` — ${formatCurrency(totalAmount)}` : ''}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={saving || items.length === 0}
              className="px-5 py-3 rounded-lg text-sm font-medium bg-slate-700/60 text-slate-300 hover:bg-slate-700 border border-slate-600 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Lưu nháp
            </button>
            <Link href="/purchases" className="btn-ghost">Hủy</Link>
          </div>
        </div>
      </main>

      {/* ── New Product Modal ── */}
      {showNewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] border border-slate-700/60 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" /> Thêm sản phẩm mới
              </h3>
              <button onClick={() => setShowNewProduct(false)} className="text-slate-500 hover:text-slate-300 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Tên sản phẩm *</label>
                <input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                  className="input" placeholder="VD: Gas 12kg, Gạo ST25..." autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Loại</label>
                  <select value={newProduct.type} onChange={e => {
                    const type = e.target.value
                    setNewProduct(p => ({ ...p, type, unit: type === 'gas' ? 'bình' : type === 'rice' ? 'kg' : 'cái' }))
                  }} className="input">
                    <option value="gas">Gas</option>
                    <option value="rice">Gạo</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="label">Đơn vị</label>
                  <input value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}
                    className="input" placeholder="bình / kg / thùng" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Giá bán lẻ (đ)</label>
                  <input type="number" min={0} step={1000} value={newProduct.priceRetail || ''}
                    onChange={e => setNewProduct(p => ({ ...p, priceRetail: Number(e.target.value) || 0 }))}
                    className="input" />
                </div>
                <div>
                  <label className="label">Giá bán sỉ (đ)</label>
                  <input type="number" min={0} step={1000} value={newProduct.priceWhole || ''}
                    onChange={e => setNewProduct(p => ({ ...p, priceWhole: Number(e.target.value) || 0 }))}
                    className="input" />
                </div>
              </div>
              <div>
                <label className="label">Tồn kho tối thiểu (ngưỡng cảnh báo)</label>
                <input type="number" min={0} step={1} value={newProduct.minStock || ''}
                  onChange={e => setNewProduct(p => ({ ...p, minStock: Number(e.target.value) || 0 }))}
                  className="input" placeholder="0" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={createProduct} disabled={creatingProduct || !newProduct.name.trim()}
                className="flex-1 btn-primary text-sm">
                {creatingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Tạo & Thêm vào phiếu
              </button>
              <button onClick={() => setShowNewProduct(false)} className="btn-ghost text-sm">Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
