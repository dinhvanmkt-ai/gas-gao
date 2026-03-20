'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, UserPlus } from 'lucide-react'

export default function NewCustomerPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    gasCylinderQty: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Vui lòng nhập tên và số điện thoại.')
      return
    }
    setSaving(true)
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      router.push(`/customers/${data.id}`)
    } else {
      const err = await res.json()
      setError(err.error || 'Có lỗi xảy ra')
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Thêm Khách Hàng" subtitle="Tạo hồ sơ khách hàng mới" />

      <main className="flex-1 p-6">
        <div className="mb-5">
          <Link href="/customers" className="btn-ghost text-sm">
            <ArrowLeft className="w-4 h-4" /> Danh sách khách hàng
          </Link>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-orange-500/20">
                <UserPlus className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-200">Thông tin khách hàng</h2>
                <p className="text-xs text-slate-500">Điền đầy đủ thông tin bên dưới</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Họ tên <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="Nguyễn Văn A"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Số điện thoại <span className="text-red-400">*</span></label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="input"
                  placeholder="0912 345 678"
                />
              </div>

              <div>
                <label className="label">Địa chỉ</label>
                <input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className="input"
                  placeholder="123 Đường ABC, Phường..."
                />
              </div>

              <div>
                <label className="label">Số bình gas hiện giữ</label>
                <input
                  type="number"
                  min={0}
                  value={form.gasCylinderQty}
                  onChange={e => setForm({ ...form, gasCylinderQty: parseInt(e.target.value) || 0 })}
                  className="input w-32"
                />
              </div>

              <div>
                <label className="label">Ghi chú</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="input"
                  placeholder="Ghi chú thêm về khách hàng..."
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Đang lưu...' : 'Tạo khách hàng'}
                </button>
                <Link href="/customers" className="btn-ghost">Hủy</Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
