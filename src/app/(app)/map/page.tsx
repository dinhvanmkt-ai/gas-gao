'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { Loader2, MapPin, Search, ShoppingCart, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

// Leaflet không hỗ trợ SSR — import động phía client
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
  </div>
)})

export default function MapPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'debt' | 'urgent' | 'cylinder'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/customers/map')
      .then(r => r.json())
      .then(d => { setCustomers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    const matchFilter =
      filter === 'all' ? true :
      filter === 'debt' ? c.debtBalance > 0 :
      filter === 'urgent' ? c.urgencyScore >= 50 :
      filter === 'cylinder' ? c.gasCylinderQty > 0 : true
    return matchSearch && matchFilter
  })

  const withCoord = customers.length
  const allCount = customers.length

  return (
    <div className="flex flex-col w-full overflow-hidden" style={{ height: '100vh', maxHeight: '100vh' }}>
      <Header title="Bản đồ khách hàng" subtitle={`${withCoord} khách hàng có tọa độ`} />      <main className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="card p-3 flex flex-col sm:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input pl-9 py-2 text-sm" placeholder="Tìm khách hàng..." />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'all',      label: 'Tất cả',    color: 'bg-slate-700 text-slate-200' },
              { key: 'urgent',   label: '🔴 Sắp mua', color: 'bg-red-500/20 text-red-300' },
              { key: 'debt',     label: '💰 Đang nợ', color: 'bg-yellow-500/20 text-yellow-300' },
              { key: 'cylinder', label: '🫙 Giữ vỏ',  color: 'bg-blue-500/20 text-blue-300' },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filter === f.key ? f.color + ' border-current' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
            <MapPin className="w-3.5 h-3.5" />
            {filtered.length}/{allCount} hiển thị
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : allCount === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
            <MapPin className="w-12 h-12 opacity-20" />
            <p className="text-center">Chưa có khách hàng nào có tọa độ</p>
            <p className="text-sm text-slate-600 text-center max-w-xs">
              Vào trang chi tiết khách hàng → bấm Sửa → nhập tọa độ GPS
            </p>
            <Link href="/customers" className="btn-primary text-sm">Đi đến danh sách khách hàng</Link>
          </div>
        ) : (
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 h-full">
            {/* Map */}
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50 min-h-[400px] lg:min-h-0 h-full">
              <MapView
                customers={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>

            {/* Sidebar list */}
            <div className="w-full lg:w-72 shrink-0 flex flex-col gap-2 overflow-y-auto max-h-[400px] lg:max-h-full h-full pr-1">
              {filtered.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Không tìm thấy</p>
              ) : (
                filtered.map(c => (
                  <button key={c.id} onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selectedId === c.id
                        ? 'bg-blue-500/15 border-blue-500/40'
                        : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-200 truncate">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.phone}</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        {c.debtBalance > 0 && (
                          <span className="text-xs text-yellow-400 font-medium">
                            Nợ {formatCurrency(c.debtBalance)}
                          </span>
                        )}
                        {c.gasCylinderQty > 0 && (
                          <span className="text-xs text-blue-400">🫙 {c.gasCylinderQty} vỏ</span>
                        )}
                        {c.urgencyScore >= 50 && (
                          <span className="text-xs text-red-400">🔴 Sắp mua</span>
                        )}
                      </div>
                    </div>
                    {c.address && <p className="text-xs text-slate-600 mt-1 truncate">{c.address}</p>}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-700/40">
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                          title="Mở chỉ đường Google Maps"
                        >
                          ↗ Chỉ đường
                        </a>
                        <span className="text-slate-700">·</span>
                        <Link href={`/customers/${c.id}`} onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-400 hover:text-blue-300">Chi tiết</Link>
                      </div>
                      <Link href={`/orders/new?customer=${c.id}`} onClick={e => e.stopPropagation()}
                        className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-0.5 font-medium">
                        <ShoppingCart className="w-3 h-3" /> Tạo đơn
                      </Link>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
