'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Plus, Trash2, UserPlus, X, CheckCircle, Calendar, Wheat } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface RiceItem {
  riceProductId: string
  productName: string
  totalKg: number | ''
  pricePerKg: number | ''
}

interface RiceProduct {
  id: string
  name: string
  lastPricePerKg: number | null
  active: boolean
}

interface Supplier {
  id: string
  name: string
  type: string
}

export default function NewRicePurchasePage() {
  const router = useRouter()
  const [riceProducts, setRiceProducts] = useState<RiceProduct[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'owe'>('paid')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<RiceItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // New supplier inline
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '' })
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    Promise.all([
      fetch('/api/rice-products').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
    ]).then(([rp, sup]) => {
      setRiceProducts(Array.isArray(rp) ? rp.filter((p: RiceProduct) => p.active) : [])
      setSuppliers(Array.isArray(sup) ? sup.filter((s: Supplier) => s.type === 'rice') : [])
    })
  }, [])

  function addItem(rp: RiceProduct) {
    if (items.find(i => i.riceProductId === rp.id)) return
    setItems(prev => [...prev, {
      riceProductId: rp.id,
      productName: rp.name,
      totalKg: '',
      pricePerKg: rp.lastPricePerKg ?? '',
    }])
  }

  function updateItem(idx: number, field: 'totalKg' | 'pricePerKg', value: string) {
    const newItems = [...items]
    newItems[idx][field] = value === '' ? '' : Number(value) as number
    setItems(newItems)
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  const totalKg = useMemo(() =>
    items.reduce((s, i) => s + (Number(i.totalKg) || 0), 0), [items])
  const totalCost = useMemo(() =>
    items.reduce((s, i) => s + (Number(i.totalKg) || 0) * (Number(i.pricePerKg) || 0), 0), [items])

  async function createSupplier() {
    if (!newSupplier.name.trim()) return
    setCreatingSupplier(true)
    const res = await fetch('/api/suppliers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSupplier, type: 'rice' }),
    })
    if (res.ok) {
      const s = await res.json()
      setSuppliers(prev => [...prev, s])
      setSupplierId(s.id)
      setShowNewSupplier(false)
      setNewSupplier({ name: '', phone: '' })
    }
    setCreatingSupplier(false)
  }

  async function handleSubmit() {
    setError('')
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 loại gạo'); return }
    const invalidItem = items.find(i => !i.totalKg || Number(i.totalKg) <= 0 || !i.pricePerKg || Number(i.pricePerKg) <= 0)
    if (invalidItem) { setError(`Vui lòng nhập đầy đủ số kg và giá/kg cho "${invalidItem.productName}"`); return }
    setSaving(true)
    const res = await fetch('/api/rice-purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplierId || null,
        purchaseDate,
        paymentStatus,
        note,
        items: items.map(i => ({
          riceProductId: i.riceProductId,
          totalKg: Number(i.totalKg),
          pricePerKg: Number(i.pricePerKg),
        })),
      }),
    })
    if (res.ok) {
      router.push('/rice-purchases')
    } else {
      const err = await res.json()
      setError(err.error || 'Có lỗi xảy ra')
    }
    setSaving(false)
  }

  const unusedProducts = riceProducts.filter(rp => !items.find(i => i.riceProductId === rp.id))

  return (
    <div className="flex flex-col flex-1">
      <Header title="Phiếu Nhập Gạo" subtitle="Tạo phiếu nhập gạo mới" />
      <main className="flex-1 p-6">
        <div className="mb-5">
          <Link href="/rice-purchases" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Danh sách nhập gạo</Link>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Supplier + Date */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Wheat className="w-4 h-4 text-green-400" /> Thông tin phiếu nhập
              </h3>
              <button type="button" onClick={() => setShowNewSupplier(!showNewSupplier)} className="btn-ghost text-xs">
                <UserPlus className="w-3.5 h-3.5" /> Tạo NCC mới
              </button>
            </div>

            {showNewSupplier && (
              <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="label">Tên NCC *</label><input value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} className="input" placeholder="Tên nhà cung cấp gạo" /></div>
                  <div><label className="label">SĐT</label><input value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} className="input" placeholder="0912..." /></div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={createSupplier} disabled={creatingSupplier} className="btn-primary text-sm">
                    {creatingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tạo NCC
                  </button>
                  <button type="button" onClick={() => setShowNewSupplier(false)} className="btn-ghost text-sm"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nhà cung cấp gạo</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="input">
                  <option value="">— Không chọn NCC —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Ngày nhập</label>
                <input type="date" value={purchaseDate} max={todayStr} onChange={e => setPurchaseDate(e.target.value)} className="input" />
              </div>
            </div>
          </div>

          {/* Rice items */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Wheat className="w-4 h-4 text-green-400" /> Hàng hóa nhập
            </h3>

            {/* Chọn loại gạo */}
            {unusedProducts.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2">Chọn loại gạo để thêm vào phiếu:</p>
                <div className="flex flex-wrap gap-2">
                  {unusedProducts.map(rp => (
                    <button key={rp.id} type="button" onClick={() => addItem(rp)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-slate-800/60 text-slate-300 border-slate-700 hover:border-green-500/50 hover:text-green-300 transition-all">
                      <Plus className="w-3 h-3 inline mr-1" />{rp.name}
                      {rp.lastPricePerKg && <span className="ml-1 text-slate-500">{formatCurrency(rp.lastPricePerKg)}/kg</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                Chọn loại gạo ở trên để thêm vào phiếu
                {riceProducts.length === 0 && (
                  <p className="mt-2">
                    <Link href="/rice-products" className="text-green-400 hover:text-green-300">Tạo danh mục loại gạo trước →</Link>
                  </p>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>Loại gạo</th>
                    <th className="text-center w-32">Số kg</th>
                    <th className="text-right w-36">Giá/kg (đ)</th>
                    <th className="text-right">Thành tiền</th>
                    <th className="w-10"></th>
                  </tr></thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.riceProductId}>
                        <td className="font-medium text-emerald-400">{item.productName}</td>
                        <td>
                          <input type="number" min={0} step={0.5} value={item.totalKg}
                            onChange={e => updateItem(idx, 'totalKg', e.target.value)}
                            placeholder="0" className="input w-28 py-1 text-center" />
                        </td>
                        <td>
                          <input type="number" min={0} step={500} value={item.pricePerKg}
                            onChange={e => updateItem(idx, 'pricePerKg', e.target.value)}
                            placeholder="0" className="input w-32 py-1 text-right" />
                        </td>
                        <td className="text-right font-semibold text-green-400">
                          {(Number(item.totalKg) || 0) > 0 && (Number(item.pricePerKg) || 0) > 0
                            ? formatCurrency((Number(item.totalKg)) * (Number(item.pricePerKg)))
                            : '—'}
                        </td>
                        <td>
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-800/50 font-bold">
                      <td className="text-right text-slate-300">Tổng cộng</td>
                      <td className="text-center text-green-400">{totalKg.toLocaleString('vi-VN')} kg</td>
                      <td className="text-right text-xs text-slate-500">
                        {totalKg > 0 ? `BQ: ${formatCurrency(totalCost / totalKg)}/kg` : ''}
                      </td>
                      <td className="text-right text-lg text-green-400">{formatCurrency(totalCost)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment & Note */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-slate-200">Thanh toán & Ghi chú</h3>
            <div>
              <label className="label">Trạng thái thanh toán NCC</label>
              <div className="flex gap-3 mt-1">
                {[
                  { value: 'paid', label: '✅ Đã trả NCC', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
                  { value: 'owe', label: '⏳ Còn nợ NCC', cls: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setPaymentStatus(opt.value as 'paid' | 'owe')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${paymentStatus === opt.value ? opt.cls : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="Ghi chú phiếu nhập..." />
            </div>
          </div>

          {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSubmit} disabled={saving || items.length === 0} className="btn-primary py-3 px-6 text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Xác nhận nhập kho{totalCost > 0 ? ` — ${formatCurrency(totalCost)}` : ''}
            </button>
            <Link href="/rice-purchases" className="btn-ghost">Hủy</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
