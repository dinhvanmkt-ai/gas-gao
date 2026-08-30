'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { ArrowLeft, Save, ShoppingBag, Plus, Trash2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import DateInput from '@/components/DateInput'
import { formatCurrency, getLocalDateString } from '@/lib/utils'

interface Product {
  id: string
  name: string
  unit: string
  type: string
  priceRetail: number
  costPrice: number | null
}

interface Supplier {
  id: string
  name: string
}

interface FormItem {
  id: string // temporary internal id
  productId: string
  productName: string
  unit: string
  qty: number | ''
  unitCost: number | ''
  costPrice: number | ''
  priceRetail: number | ''
}

export default function NewOtherPurchasePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  
  const [purchaseDate, setPurchaseDate] = useState(getLocalDateString())
  const [supplierId, setSupplierId] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [note, setNote] = useState('')
  
  const [items, setItems] = useState<FormItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch products (type = 'other')
    fetch('/api/products')
      .then(r => r.json())
      .then((data: Product[]) => setProducts(data.filter(p => p.type === 'other')))
      .catch(console.error)

    // Fetch suppliers
    fetch('/api/suppliers')
      .then(r => r.json())
      .then((data: Supplier[]) => setSuppliers(data))
      .catch(console.error)
  }, [])

  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        productId: '',
        productName: '',
        unit: '',
        qty: '',
        unitCost: '',
        costPrice: '',
        priceRetail: '',
      }
    ])
  }

  const updateItem = (id: string, field: keyof FormItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      
      const updated = { ...item, [field]: value }
      
      // Auto fill if product selected
      if (field === 'productId') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          updated.productName = prod.name
          updated.unit = prod.unit
          updated.priceRetail = prod.priceRetail
          updated.costPrice = prod.costPrice || 0
          // Default unitCost to costPrice initially if available
          updated.unitCost = prod.costPrice || 0 
        }
      }
      return updated
    }))
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitCost) || 0), 0)
  }, [items])

  const totalProfit = useMemo(() => {
    return items.reduce((sum, item) => {
      const q = Number(item.qty) || 0
      const retail = Number(item.priceRetail) || 0
      const cost = Number(item.costPrice) || Number(item.unitCost) || 0
      return sum + (retail - cost) * q
    }, 0)
  }, [items])

  async function handleSubmit(action: 'draft' | 'confirm') {
    if (items.length === 0) {
      setError('Vui lòng thêm ít nhất 1 sản phẩm')
      return
    }

    const invalidItems = items.filter(i => !i.productId || Number(i.qty) <= 0 || i.unitCost === '')
    if (invalidItems.length > 0) {
      setError('Vui lòng điền đầy đủ sản phẩm, số lượng và giá nhập')
      return
    }

    setSubmitting(true)
    setError('')

    const payload = {
      action,
      purchaseDate,
      supplierId: supplierId || null,
      paymentStatus,
      note,
      items: items.map(i => ({
        productId: i.productId,
        qty: Number(i.qty),
        unitCost: Number(i.unitCost),
        costPrice: Number(i.costPrice),
        priceRetail: Number(i.priceRetail)
      }))
    }

    try {
      const res = await fetch('/api/other-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        router.push('/other-purchases')
      } else {
        const err = await res.json()
        setError(err.error || 'Có lỗi xảy ra')
        setSubmitting(false)
      }
    } catch (e) {
      setError('Lỗi kết nối')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Header 
        title="Tạo Phiếu Nhập SP Khác" 
        subtitle="Nhập các sản phẩm khác (ngoài gas, gạo)"
        action={
          <Link href="/other-purchases" className="btn-ghost flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Link>
        }
      />
      
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-purple-400" />
              Thông tin phiếu nhập
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Ngày nhập</label>
                <DateInput value={purchaseDate} onChange={setPurchaseDate} className="input w-full" />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Nhà cung cấp</label>
                <select 
                  className="input w-full"
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                >
                  <option value="">-- Chọn NCC --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Thanh toán</label>
                <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      paymentStatus === 'paid' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Đã trả
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('owe')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      paymentStatus === 'owe' ? 'bg-yellow-500 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Nợ NCC
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-slate-400">Ghi chú</label>
              <input 
                type="text" 
                className="input w-full"
                placeholder="Ghi chú thêm về phiếu nhập..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-200">Chi tiết hàng hóa</h2>
              <button 
                onClick={addItem}
                className="btn-ghost flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
              >
                <Plus className="w-4 h-4" /> Thêm dòng
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="pb-3 font-medium min-w-[200px]">Sản phẩm</th>
                    <th className="pb-3 font-medium w-24">ĐVT</th>
                    <th className="pb-3 font-medium w-24">SL</th>
                    <th className="pb-3 font-medium w-32">Giá nhập</th>
                    <th className="pb-3 font-medium w-32 text-slate-500" title="Đồng bộ từ giá nhập, dùng để tính LN">Giá vốn</th>
                    <th className="pb-3 font-medium w-32">Giá bán lẻ</th>
                    <th className="pb-3 font-medium w-32">Lợi nhuận/đv</th>
                    <th className="pb-3 font-medium w-32 text-right">Thành tiền</th>
                    <th className="pb-3 font-medium w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        Chưa có sản phẩm nào. Hãy thêm dòng mới.
                      </td>
                    </tr>
                  ) : items.map((item, index) => {
                    const q = Number(item.qty) || 0
                    const uc = Number(item.unitCost) || 0
                    const subtotal = q * uc
                    
                    const retail = Number(item.priceRetail) || 0
                    const cost = item.costPrice !== '' ? Number(item.costPrice) : uc
                    const profit = retail - cost

                    return (
                      <tr key={item.id} className="group">
                        <td className="py-2 pr-2">
                          <select 
                            className="input w-full py-1.5 px-2 text-sm"
                            value={item.productId}
                            onChange={e => updateItem(item.id, 'productId', e.target.value)}
                          >
                            <option value="">-- Chọn --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input type="text" className="input w-full py-1.5 px-2 text-sm bg-slate-800/50" value={item.unit} readOnly />
                        </td>
                        <td className="py-2 pr-2">
                          <input 
                            type="number" 
                            min="1"
                            className="input w-full py-1.5 px-2 text-sm" 
                            value={item.qty}
                            onChange={e => updateItem(item.id, 'qty', e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input 
                            type="number" 
                            className="input w-full py-1.5 px-2 text-sm" 
                            value={item.unitCost}
                            onChange={e => {
                              updateItem(item.id, 'unitCost', e.target.value)
                              // Nếu costPrice đang rỗng hoặc bằng unitCost cũ, update luôn costPrice
                              if (item.costPrice === '' || Number(item.costPrice) === Number(item.unitCost)) {
                                updateItem(item.id, 'costPrice', e.target.value)
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input 
                            type="number" 
                            className="input w-full py-1.5 px-2 text-sm text-slate-400" 
                            value={item.costPrice}
                            onChange={e => updateItem(item.id, 'costPrice', e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input 
                            type="number" 
                            className="input w-full py-1.5 px-2 text-sm" 
                            value={item.priceRetail}
                            onChange={e => updateItem(item.id, 'priceRetail', e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <div className={`text-sm font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                          </div>
                        </td>
                        <td className="py-2 text-right font-medium text-blue-400 pr-2">
                          {formatCurrency(subtotal)}
                        </td>
                        <td className="py-2 text-center">
                          <button 
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-700/50">
                      <td colSpan={7} className="py-4 text-right text-slate-400 font-medium pr-4">
                        Tổng cộng:
                      </td>
                      <td className="py-4 text-right font-bold text-blue-400 text-lg">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="pb-4 text-right text-slate-500 text-sm pr-4">
                        Lợi nhuận ước tính (nếu bán hết):
                      </td>
                      <td className={`pb-4 text-right font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
              <button
                type="button"
                onClick={() => router.push('/other-purchases')}
                className="btn-ghost"
                disabled={submitting}
              >
                Hủy
              </button>
              
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                disabled={submitting || items.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Lưu nháp
              </button>

              <button
                type="button"
                onClick={() => handleSubmit('confirm')}
                disabled={submitting || items.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-500 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-500/25"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Xác nhận nhập kho
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
