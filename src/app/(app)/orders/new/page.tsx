'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, ShoppingCart, Plus, Trash2, Search,
  RefreshCw, Package, AlertTriangle, Calendar
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface OrderItem {
  productId: string
  productName: string
  unit: string
  productType: string
  qty: number
  unitPrice: number
}

export default function NewOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedCustomer = searchParams.get('customer') ?? ''

  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [customerId, setCustomerId] = useState(preSelectedCustomer)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paidAmount, setPaidAmount] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  // Cylinder transaction state
  const [cylinderTxType, setCylinderTxType] = useState<'exchange' | 'borrow'>('exchange')
  const [cylinderQty, setCylinderQty] = useState(1)
  const [cylinderBorrowMode, setCylinderBorrowMode] = useState<'deposit' | 'debt'>('deposit')
  const [cylinderDepositAmount, setCylinderDepositAmount] = useState<number | ''>(200000)

  // Order date — defaults to today, can be changed to backdate
  const todayStr = new Date().toISOString().split('T')[0]
  const [orderDate, setOrderDate] = useState(todayStr)

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
    ]).then(([c, p]) => {
      setCustomers(Array.isArray(c) ? c : [])
      setProducts(Array.isArray(p) ? p : [])
    })
  }, [])

  function addItem(product: any) {
    if (items.find(i => i.productId === product.id)) return
    setItems([...items, {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      productType: product.type,
      qty: 1,
      unitPrice: product.priceRetail,
    }])
  }

  function updateItem(idx: number, field: string, value: number) {
    const newItems = [...items]
    ;(newItems[idx] as any)[field] = value
    setItems(newItems)
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  const totalAmount = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  // Nợ = bất kỳ số tiền chưa trả (nhất quán với logic API)
  const previewDebt = Math.max(0, totalAmount - (Number(paidAmount) || 0))

  // Check if order contains gas
  const hasGasItem = items.some(i => i.productType === 'gas')
  const selectedCustomer = customers.find(c => c.id === customerId)
  const customerCylinderQty = selectedCustomer?.gasCylinderQty ?? 0
  // Cảnh báo exchange: khách không có vỏ để trả
  const exchangeWarning = cylinderTxType === 'exchange' && customerCylinderQty === 0

  // Auto-set cylinderQty to match gas items total
  const gasQtyTotal = useMemo(() =>
    items.filter(i => i.productType === 'gas').reduce((s, i) => s + Math.ceil(i.qty), 0),
    [items]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!customerId) { setError('Vui lòng chọn khách hàng'); return }
    if (items.length === 0) { setError('Vui lòng thêm ít nhất 1 sản phẩm'); return }

    setSaving(true)
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        paymentMethod,
        paidAmount: Number(paidAmount) || 0,
        note,
        orderDate,   // ← ngày mua do người dùng chọn
        items: items.map(i => ({
          productId: i.productId,
          qty: i.qty,
          unitPrice: i.unitPrice,
        })),
        // Cylinder
        ...(hasGasItem ? {
          cylinderTxType,
          cylinderQty: cylinderQty || gasQtyTotal,
          cylinderBorrowMode,
          cylinderDepositAmount: Number(cylinderDepositAmount) || 0,
        } : {}),
      }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/orders/${data.id}`)
    } else {
      const err = await res.json()
      setError(err.error || 'Có lỗi xảy ra')
    }
    setSaving(false)
  }

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
    : customers

  return (
    <div className="flex flex-col flex-1">
      <Header title="Tạo Đơn Hàng" subtitle="Tạo đơn hàng mới" />

      <main className="flex-1 p-6">
        <div className="mb-5">
          <Link href="/orders" className="btn-ghost text-sm">
            <ArrowLeft className="w-4 h-4" /> Danh sách đơn hàng
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
          {/* Customer selection */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" /> Khách hàng
            </h3>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-200">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                  {selectedCustomer.gasCylinderQty > 0 && (
                    <p className="text-xs text-yellow-400 mt-0.5">
                      Đang giữ {selectedCustomer.gasCylinderQty} vỏ bình
                      {selectedCustomer.cylinderDeposit > 0 && ` · Cọc: ${formatCurrency(selectedCustomer.cylinderDeposit)}`}
                      {selectedCustomer.cylinderDebt > 0 && ` · Nợ vỏ: ${selectedCustomer.cylinderDebt} bình`}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setCustomerId('')} className="btn-ghost text-xs">Đổi</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="input pl-9"
                    placeholder="Tìm khách hàng theo tên hoặc SĐT..."
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredCustomers.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCustomerId(c.id); setCustomerSearch('') }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/40 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-300">{c.name.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.phone}</p>
                      </div>
                      {c.gasCylinderQty > 0 && (
                        <span className="ml-auto badge-yellow text-xs">{c.gasCylinderQty} vỏ</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Products */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-400" /> Sản phẩm
            </h3>

            <div className="flex flex-wrap gap-2 mb-4">
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p)}
                  disabled={items.some(i => i.productId === p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    items.some(i => i.productId === p.id)
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-orange-500/50'
                  }`}
                >
                  <Plus className="w-3 h-3 inline mr-1" />{p.name} ({formatCurrency(p.priceRetail)})
                </button>
              ))}
            </div>

            {items.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th></th>
                  </tr></thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.productId}>
                        <td className="font-medium">{item.productName} <span className="text-slate-500 text-xs">({item.unit})</span></td>
                        <td>
                          <input type="number" min={0.1} step={0.1} value={item.qty}
                            onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                            className="input w-24 py-1 text-center" />
                        </td>
                        <td>
                          <input type="number" min={0} step={1000} value={item.unitPrice}
                            onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="input w-32 py-1 text-right" />
                        </td>
                        <td className="font-semibold text-orange-400">{formatCurrency(item.qty * item.unitPrice)}</td>
                        <td>
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-800/50">
                      <td colSpan={3} className="text-right font-semibold text-slate-300">Tổng cộng</td>
                      <td className="font-bold text-lg text-orange-400">{formatCurrency(totalAmount)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cylinder Transaction Type — only shown when gas in order */}
          {hasGasItem && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-400" /> Giao dịch vỏ bình
              </h3>

              {/* Exchange warning if customer has 0 cylinders at their place */}
              {hasGasItem && cylinderTxType === 'exchange' && exchangeWarning && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">
                    Khách hàng <strong>không có vỏ nào</strong> để trả. Hãy chọn <strong>Mượn vỏ</strong> nếu lần đầu tiên.
                  </p>
                </div>
              )}
              {/* Many cylinders warning */}
              {customerCylinderQty >= 3 && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <p className="text-xs text-yellow-300">
                    Khách hàng đang giữ <strong>{customerCylinderQty} vỏ bình</strong>. Xem xét yêu cầu đổi trước khi cho mượn thêm.
                  </p>
                </div>
              )}



              {/* Radio: Đổi bình / Mượn vỏ */}
              <div className="flex gap-3 mb-4">
                {[
                  { value: 'exchange', icon: RefreshCw, label: 'Đổi bình', desc: 'Khách trả vỏ rỗng, lấy bình đầy' },
                  { value: 'borrow', icon: Package, label: 'Mượn vỏ', desc: 'Khách lấy bình đầy, giữ vỏ' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCylinderTxType(opt.value as any)}
                    className={`flex-1 rounded-xl p-4 border-2 text-left transition-all ${
                      cylinderTxType === opt.value
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <opt.icon className={`w-4 h-4 ${cylinderTxType === opt.value ? 'text-orange-400' : 'text-slate-500'}`} />
                      <span className={`font-semibold text-sm ${cylinderTxType === opt.value ? 'text-orange-300' : 'text-slate-300'}`}>{opt.label}</span>
                    </div>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Cylinder quantity */}
              <div className="flex items-center gap-4 mb-4">
                <label className="label shrink-0">Số vỏ giao dịch</label>
                <input
                  type="number"
                  min={1}
                  value={cylinderQty}
                  onChange={e => setCylinderQty(parseInt(e.target.value) || 1)}
                  className="input w-24"
                />
                {gasQtyTotal > 0 && cylinderQty !== gasQtyTotal && (
                  <button type="button" onClick={() => setCylinderQty(gasQtyTotal)}
                    className="text-xs text-orange-400 hover:text-orange-300">
                    Tự động: {gasQtyTotal} bình
                  </button>
                )}
              </div>

              {/* Borrow mode options */}
              {cylinderTxType === 'borrow' && (
                <div className="pl-4 border-l-2 border-orange-500/30 space-y-3">
                  <div className="flex gap-3">
                    {[
                      { value: 'deposit', label: 'Thu tiền cọc vỏ' },
                      { value: 'debt', label: 'Ghi nợ vỏ' },
                    ].map(m => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setCylinderBorrowMode(m.value as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          cylinderBorrowMode === m.value
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
                            : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:border-slate-600'
                        }`}
                      >{m.label}</button>
                    ))}
                  </div>

                  {cylinderBorrowMode === 'deposit' && (
                    <div className="flex items-center gap-3">
                      <label className="label shrink-0">Tiền cọc/vỏ</label>
                      <input
                        type="number"
                        min={0}
                        step={50000}
                        value={cylinderDepositAmount}
                        onChange={e => setCylinderDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="input w-40"
                        placeholder="200,000"
                      />
                      <span className="text-xs text-slate-500">
                        Tổng cọc: {formatCurrency((Number(cylinderDepositAmount) || 0) * cylinderQty)}
                      </span>
                    </div>
                  )}

                  {cylinderBorrowMode === 'debt' && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
                      Ghi nợ <strong>{cylinderQty} vỏ bình</strong> cho khách hàng
                      {selectedCustomer?.cylinderDebt > 0 && ` (đang nợ ${selectedCustomer.cylinderDebt} vỏ)`}
                    </div>
                  )}
                </div>
              )}

              {/* Exchange summary */}
              {cylinderTxType === 'exchange' && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  Nhận <strong>{cylinderQty} vỏ rỗng</strong> từ khách → Xuất <strong>{cylinderQty} bình đầy</strong> từ kho
                </div>
              )}
            </div>
          )}

          {/* Payment */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-4">Thanh toán</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Phương thức</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input">
                  <option value="cash">Tiền mặt</option>
                  <option value="transfer">Chuyển khoản</option>
                  <option value="debt">Công nợ</option>
                </select>
              </div>
              {paymentMethod === 'debt' && (
                <div>
                  <label className="label">Đã trả trước</label>
                  <input type="number" min={0} value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="input" placeholder="0" />
                </div>
              )}
              {previewDebt > 0 && (
                <div>
                  <label className="label">Còn nợ (dự kiến)</label>
                  <p className="text-lg font-bold text-red-400 mt-2">{formatCurrency(previewDebt)}</p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <label className="label">Ghi chú</label>
              <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="Ghi chú cho đơn hàng..." />
            </div>
            {/* Order date — editable for backdating */}
            <div className="mt-4">
              <label className="label flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-400" />
                Ngày mua hàng
              </label>
              <input
                id="order-date"
                type="date"
                value={orderDate}
                max={todayStr}
                onChange={e => setOrderDate(e.target.value)}
                className="input w-44"
              />
              {orderDate !== todayStr && (
                <p className="text-xs text-yellow-400 mt-1">⚠ Đơn hàng sẽ được ghi nhận vào ngày {orderDate}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary py-3 px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Đang tạo...' : `Tạo đơn hàng — ${formatCurrency(totalAmount)}`}
            </button>
            <Link href="/orders" className="btn-ghost">Hủy</Link>
          </div>
        </form>
      </main>
    </div>
  )
}
