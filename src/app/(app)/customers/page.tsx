'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { Search, Plus, Phone, Users, Filter, ArrowUpDown, Loader2, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, urgencyColor, urgencyLabel, daysUntil } from '@/lib/utils'
import Link from 'next/link'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('urgency')
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}&sort=${sort}`)
    const data = await res.json()
    setCustomers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [q, sort])

  return (
    <div className="flex flex-col flex-1">
      <Header title="Khách Hàng" subtitle="Danh sách và dự đoán mua hàng" />

      <main className="flex-1 p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm tên, SĐT, địa chỉ..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="input pl-9"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input w-auto"
            >
              <option value="urgency">Ưu tiên mua</option>
              <option value="name">Tên A-Z</option>
              <option value="recent">Mới nhất</option>
            </select>
          </div>
          <Link href="/customers/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Thêm khách hàng
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4">
            <p className="text-xs text-slate-500 mb-1">Tổng khách hàng</p>
            <p className="text-xl font-bold text-slate-100">{customers.length}</p>
          </div>
          <div className="card p-4 kpi-red">
            <p className="text-xs text-slate-500 mb-1">Khẩn cấp</p>
            <p className="text-xl font-bold text-red-400">{customers.filter(c => c.urgencyScore >= 80).length}</p>
          </div>
          <div className="card p-4 kpi-yellow">
            <p className="text-xs text-slate-500 mb-1">Sắp mua</p>
            <p className="text-xl font-bold text-yellow-400">{customers.filter(c => c.urgencyScore >= 50 && c.urgencyScore < 80).length}</p>
          </div>
          <div className="card p-4 kpi-orange">
            <p className="text-xs text-slate-500 mb-1">Có công nợ</p>
            <p className="text-xl font-bold text-orange-400">{customers.filter(c => c.debtBalance > 0).length}</p>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p>Không tìm thấy khách hàng</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Dự đoán Gas</th>
                  <th>Dự đoán Gạo</th>
                  <th>Bình gas</th>
                  <th>Công nợ</th>
                  <th>Mức độ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const gasdays = daysUntil(c.gasPredictedDate)
                  const ricedays = daysUntil(c.ricePredictedDate)
                  return (
                    <tr key={c.id}>
                      <td>
                        <div>
                          <p className="font-medium text-slate-200">{c.name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />{c.phone}
                          </p>
                        </div>
                      </td>
                      <td>
                        {c.gasPredictedDate ? (
                          <div>
                            <p className="text-sm">{formatDate(c.gasPredictedDate)}</p>
                            <p className={`text-xs ${gasdays !== null && gasdays <= 0 ? 'text-red-400' : gasdays !== null && gasdays <= 3 ? 'text-yellow-400' : 'text-slate-500'}`}>
                              {gasdays === null ? '—' : gasdays <= 0 ? 'Đã quá hạn' : `Còn ${gasdays} ngày`}
                            </p>
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td>
                        {c.ricePredictedDate ? (
                          <div>
                            <p className="text-sm">{formatDate(c.ricePredictedDate)}</p>
                            <p className={`text-xs ${ricedays !== null && ricedays <= 0 ? 'text-red-400' : ricedays !== null && ricedays <= 3 ? 'text-yellow-400' : 'text-slate-500'}`}>
                              {ricedays === null ? '—' : ricedays <= 0 ? 'Đã quá hạn' : `Còn ${ricedays} ngày`}
                            </p>
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td>
                        {c.gasCylinderQty > 0 ? (
                          <span className="badge-orange">{c.gasCylinderQty} bình</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td>
                        {c.debtBalance > 0 ? (
                          <span className="text-red-400 font-medium">{formatCurrency(c.debtBalance)}</span>
                        ) : <span className="text-emerald-400 text-xs">Đã thanh toán</span>}
                      </td>
                      <td>
                        <span className={urgencyColor(c.urgencyScore)}>
                          {urgencyLabel(c.urgencyScore)}
                        </span>
                      </td>
                      <td>
                        <Link href={`/customers/${c.id}`} className="btn-ghost text-xs">
                          Chi tiết →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
