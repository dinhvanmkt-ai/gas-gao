'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, CheckCircle, Clock, Save, ShoppingBag, Truck } from 'lucide-react'
import Link from 'next/link'

interface PurchaseDetail {
  id: string
  purchaseNo: string
  purchaseDate: string
  supplier: { name: string } | null
  paymentStatus: string
  status: string
  totalAmount: string | number
  paidAmount: string | number
  note: string | null
  createdAt: string
  items: {
    id: string
    qty: number
    unitCost: number
    subtotal: number
    product: {
      id: string
      name: string
      unit: string
      priceRetail: number
      costPrice: number | null
    }
  }[]
}

export default function OtherPurchaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<PurchaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/other-purchases/${params.id}`)
      if (!res.ok) {
        setError('Không tìm thấy phiếu nhập')
      } else {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      setError('Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [params.id])

  async function markPaid() {
    try {
      const res = await fetch(`/api/other-purchases/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'paid' })
      })
      if (res.ok) {
        await load()
      }
    } catch (error) {
      console.error(error)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Chi Tiết Phiếu Nhập" />
        <div className="flex-1 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Lỗi" />
        <div className="p-6 text-center text-red-400">{error}</div>
      </div>
    )
  }

  const profitEst = data.items.reduce((sum, item) => {
    const cost = item.product.costPrice ?? item.unitCost
    return sum + (item.product.priceRetail - cost) * item.qty
  }, 0)

  return (
    <div className="flex flex-col flex-1">
      <Header 
        title={`Phiếu Nhập: ${data.purchaseNo}`}
        subtitle={`Tạo lúc: ${formatDate(data.createdAt)}`}
        action={
          <Link href="/other-purchases" className="btn-ghost flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Link>
        }
      />
      
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Mã phiếu</p>
              <p className="text-lg font-bold font-mono text-purple-400">{data.purchaseNo}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Ngày nhập</p>
              <p className="text-lg font-bold text-slate-200">{formatDate(data.purchaseDate)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Tổng tiền</p>
              <p className="text-lg font-bold text-blue-400">{formatCurrency(Number(data.totalAmount))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Nhà cung cấp</p>
              <p className="text-lg font-bold text-slate-200">{data.supplier?.name || '—'}</p>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-purple-400" />
                Chi tiết hàng hóa
              </h2>
              <div className="flex gap-2">
                {data.status === 'received' ? (
                  <span className="badge-green text-sm px-3 py-1 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Đã nhập kho
                  </span>
                ) : (
                  <span className="badge-yellow text-sm px-3 py-1 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Bản nháp
                  </span>
                )}

                {data.paymentStatus === 'paid' ? (
                  <span className="badge-green text-sm px-3 py-1">Đã thanh toán</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="badge-yellow text-sm px-3 py-1">Đang nợ NCC</span>
                    <button 
                      onClick={markPaid}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                    >
                      Đánh dấu đã trả
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="pb-3 font-medium">Sản phẩm</th>
                    <th className="pb-3 font-medium w-24">ĐVT</th>
                    <th className="pb-3 font-medium w-24 text-right">Số lượng</th>
                    <th className="pb-3 font-medium w-32 text-right">Giá nhập</th>
                    <th className="pb-3 font-medium w-32 text-right">Giá vốn</th>
                    <th className="pb-3 font-medium w-32 text-right">Giá bán lẻ</th>
                    <th className="pb-3 font-medium w-32 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {data.items.map(item => {
                    const cost = item.product.costPrice ?? item.unitCost
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/20">
                        <td className="py-3 font-medium text-slate-200">{item.product.name}</td>
                        <td className="py-3 text-slate-400">{item.product.unit}</td>
                        <td className="py-3 text-right">{item.qty.toLocaleString('vi-VN')}</td>
                        <td className="py-3 text-right">{formatCurrency(item.unitCost)}</td>
                        <td className="py-3 text-right text-slate-400">{formatCurrency(cost)}</td>
                        <td className="py-3 text-right text-slate-400">{formatCurrency(item.product.priceRetail)}</td>
                        <td className="py-3 text-right font-medium text-blue-400">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700/50">
                    <td colSpan={6} className="py-4 text-right font-medium text-slate-400">Tổng tiền nhập:</td>
                    <td className="py-4 text-right font-bold text-blue-400 text-lg">
                      {formatCurrency(Number(data.totalAmount))}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="pb-4 text-right text-sm text-slate-500">Lợi nhuận ước tính (nếu bán hết):</td>
                    <td className={`pb-4 text-right font-bold ${profitEst >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {profitEst >= 0 ? '+' : ''}{formatCurrency(profitEst)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            {data.note && (
              <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <p className="text-sm font-medium text-slate-400 mb-1">Ghi chú</p>
                <p className="text-sm text-slate-200">{data.note}</p>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
