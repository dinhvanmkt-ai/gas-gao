'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Search, Package, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function CylinderReturnPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [qty, setQty] = useState(1)
  const [returnMode, setReturnMode] = useState<'deposit' | 'debt' | 'none'>('deposit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<any>(null)

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => {
      // Only customers with cylinders
      const withCylinders = Array.isArray(d) ? d.filter((c: any) => c.gasCylinderQty > 0) : []
      setCustomers(withCylinders)
    })
  }, [])

  const selectedCustomer = customers.find(c => c.id === customerId)

  // Auto-select correct return mode when customer changes
  function onSelectCustomer(id: string) {
    setCustomerId(id)
    setCustomerSearch('')
    const c = customers.find(x => x.id === id)
    if (c) {
      if (c.cylinderDeposit > 0) setReturnMode('deposit')
      else if (c.cylinderDebt > 0) setReturnMode('debt')
      else setReturnMode('none')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!customerId) { setError('Vui lòng chọn khách hàng'); return }
    if (qty <= 0) { setError('Số vỏ phải lớn hơn 0'); return }
    if (selectedCustomer && qty > selectedCustomer.gasCylinderQty) {
      setError(`Khách chỉ đang giữ ${selectedCustomer.gasCylinderQty} vỏ`); return
    }
    if (returnMode === 'none') {
      setError('Khách hàng không có tiền cọc hoặc nợ vỏ để xử lý'); return
    }

    setSaving(true)
    const res = await fetch('/api/cylinders/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, qty, returnMode }),
    })

    if (res.ok) {
      const data = await res.json()
      setSuccess(data)
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
      <Header title="Trả Vỏ Bình Gas" subtitle="Ghi nhận khách hàng trả vỏ bình" />

      <main className="flex-1 p-6">
        <div className="mb-5">
          <Link href="/inventory" className="btn-ghost text-sm">
            <ArrowLeft className="w-4 h-4" /> Kho hàng
          </Link>
        </div>

        {success ? (
          <div className="max-w-lg mx-auto card p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-200">Trả vỏ thành công!</h2>
            <div className="text-sm text-slate-400 space-y-1 bg-slate-800/50 rounded-xl p-4 text-left">
              <p><span className="text-slate-500">Số vỏ đã trả:</span> <strong className="text-slate-200">{success.returned}</strong></p>
              <p><span className="text-slate-500">Vỏ còn lại:</span> <strong className="text-slate-200">{success.newCylinderQty}</strong></p>
              {success.refundedDeposit > 0 && (
                <p><span className="text-slate-500">Hoàn cọc:</span> <strong className="text-emerald-400">{formatCurrency(success.refundedDeposit)}</strong></p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setSuccess(null); setCustomerId(''); setQty(1) }} className="btn-secondary">
                Trả vỏ tiếp
              </button>
              <Link href="/inventory" className="btn-primary">Về kho hàng</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-5">
            {/* Customer */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" /> Khách hàng (có vỏ đang giữ)
              </h3>
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-200">{selectedCustomer.name}</p>
                    <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs">
                      <span className="text-yellow-400">Đang giữ: {selectedCustomer.gasCylinderQty} vỏ</span>
                      {selectedCustomer.cylinderDeposit > 0 && (
                        <span className="text-emerald-400">Cọc: {formatCurrency(selectedCustomer.cylinderDeposit)}</span>
                      )}
                      {selectedCustomer.cylinderDebt > 0 && (
                        <span className="text-red-400">Nợ vỏ: {selectedCustomer.cylinderDebt}</span>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => setCustomerId('')} className="btn-ghost text-xs">Đổi</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                      className="input pl-9" placeholder="Tìm khách hàng..." />
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">Không có khách hàng nào đang giữ vỏ</p>
                    ) : filteredCustomers.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { onSelectCustomer(c.id) }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/40 transition-colors text-left">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-300">
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.phone}</p>
                        </div>
                        <span className="badge-yellow text-xs">{c.gasCylinderQty} vỏ</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Return details */}
            {selectedCustomer && (
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-400" /> Chi tiết trả vỏ
                </h3>

                <div className="flex items-center gap-4">
                  <label className="label shrink-0">Số vỏ trả</label>
                  <input type="number" min={1} max={selectedCustomer.gasCylinderQty}
                    value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
                    className="input w-24" />
                  <span className="text-xs text-slate-500">/ {selectedCustomer.gasCylinderQty} vỏ</span>
                </div>

                {/* Return mode: auto-detect or choose */}
                <div>
                  <label className="label mb-2">Xử lý khi trả</label>
                  <div className="flex gap-3">
                    {[
                      { value: 'deposit', label: 'Hoàn tiền cọc', disabled: selectedCustomer.cylinderDeposit <= 0 },
                      { value: 'debt', label: 'Xóa nợ vỏ', disabled: selectedCustomer.cylinderDebt <= 0 },
                      { value: 'none', label: 'Trả vỏ (không cọc/nợ)', disabled: selectedCustomer.cylinderDeposit > 0 || selectedCustomer.cylinderDebt > 0 },
                    ].map(m => (
                      <button key={m.value} type="button"
                        onClick={() => !m.disabled && setReturnMode(m.value as any)}
                        disabled={m.disabled}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                          m.disabled
                            ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                            : returnMode === m.value
                              ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                              : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >{m.label}</button>
                    ))}
                  </div>

                  {returnMode === 'deposit' && selectedCustomer.cylinderDeposit > 0 && (
                    <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                      Sẽ hoàn ~ <strong>{formatCurrency((selectedCustomer.cylinderDeposit / selectedCustomer.gasCylinderQty) * qty)}</strong> tiền cọc
                    </div>
                  )}
                  {returnMode === 'debt' && selectedCustomer.cylinderDebt > 0 && (
                    <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                      Sẽ xóa <strong>{Math.min(qty, selectedCustomer.cylinderDebt)} vỏ</strong> khỏi nợ vỏ
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={saving || !customerId} className="btn-primary flex-1 py-3">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang xử lý...' : 'Xác nhận trả vỏ'}
              </button>
              <Link href="/inventory" className="btn-ghost">Hủy</Link>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
