'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatCurrency } from '@/lib/utils'

interface CustomerMapItem {
  id: string
  name: string
  phone: string
  address?: string | null
  lat: number
  lng: number
  debtBalance: number
  urgencyScore: number
  gasCylinderQty: number
  cylinderDebt: number
  gasLastBuyDate?: string | null
  gasPredictedDate?: string | null
}

interface MapViewProps {
  customers: CustomerMapItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// ── Màu marker theo trạng thái ────────────────────────────────────────────────
function getMarkerColor(c: CustomerMapItem): string {
  if (c.urgencyScore >= 50) return '#ef4444'
  if (c.debtBalance > 0) return '#eab308'
  if (c.gasCylinderQty > 0) return '#3b82f6'
  return '#10b981'
}

// ── Tạo divIcon: label tên phía TRÊN pin SVG ─────────────────────────────────
function makeIcon(c: CustomerMapItem, isSelected: boolean, showLabel: boolean): L.DivIcon {
  const color = getMarkerColor(c)
  const size = isSelected ? 36 : 28
  const pinH = Math.round(size * 1.3)
  const labelH = showLabel ? 20 : 0

  const label = showLabel
    ? `<div style="
        position:absolute;
        top:0;
        left:50%;
        transform:translateX(-50%);
        background:white;
        color:#1e293b;
        font-size:10px;
        font-weight:700;
        font-family:Inter,system-ui,sans-serif;
        padding:1px 5px;
        border-radius:4px;
        white-space:nowrap;
        border:1px solid ${isSelected ? color : '#cbd5e1'};
        box-shadow:0 1px 3px rgba(0,0,0,0.35);
        pointer-events:none;
      ">${c.name}</div>`
    : ''

  const totalH = labelH + pinH
  const html = `
    <div style="position:relative;width:${size}px;height:${totalH}px;">
      ${label}
      <div style="position:absolute;top:${labelH}px;left:0;">
        <svg width="${size}" height="${pinH}" viewBox="0 0 24 36"
             xmlns="http://www.w3.org/2000/svg"
             style="filter:drop-shadow(0px 3px 4px rgba(0,0,0,0.45));">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 24 12 24s12-15.5 12-24c0-6.627-5.373-12-12-12zm0 17.5c-3.038 0-5.5-2.462-5.5-5.5S8.962 6.5 12 6.5s5.5 2.462 5.5 5.5-2.462 5.5-5.5 5.5z"
                fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
        </svg>
      </div>
    </div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, totalH],
    iconAnchor: [size / 2, totalH],
    popupAnchor: [0, -pinH],
  })
}

// ── HTML popup nội dung khách hàng ────────────────────────────────────────────
function buildPopupHTML(c: CustomerMapItem): string {
  const badges = [
    c.debtBalance > 0
      ? `<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(234,179,8,0.15);color:#fde047;font-weight:600;">
           Nợ: ${formatCurrency(c.debtBalance)}
         </span>`
      : '',
    c.gasCylinderQty > 0
      ? `<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(59,130,246,0.15);color:#93c5fd;">
           🫙 Giữ ${c.gasCylinderQty} vỏ
         </span>`
      : '',
    c.urgencyScore >= 50
      ? `<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.15);color:#fca5a5;font-weight:600;">
           🔴 Khẩn cấp
         </span>`
      : '',
  ].filter(Boolean).join('')

  const address = c.address
    ? `<p style="font-size:12px;color:#94a3b8;margin:0 0 8px;display:flex;gap:4px;">
         📍 ${c.address}
       </p>`
    : ''

  return `
    <div style="min-width:210px;font-family:Inter,system-ui,sans-serif;padding:4px 2px;">
      <div style="border-bottom:1px solid #334155;padding-bottom:8px;margin-bottom:8px;">
        <h4 style="margin:0 0 2px;font-size:14px;font-weight:700;color:#f1f5f9;">${c.name}</h4>
        <a href="tel:${c.phone}"
           style="font-size:12px;color:#7dd3fc;text-decoration:none;">📞 ${c.phone}</a>
      </div>
      ${address}
      ${badges ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${badges}</div>` : ''}
      <div style="display:flex;gap:6px;border-top:1px solid #334155;padding-top:8px;align-items:center;justify-content:space-between;">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}"
           target="_blank" rel="noopener"
           style="font-size:12px;padding:4px 10px;border-radius:6px;background:rgba(59,130,246,0.2);color:#93c5fd;font-weight:600;text-decoration:none;">
          ↗ Chỉ đường
        </a>
        <a href="/customers/${c.id}"
           style="font-size:12px;color:#94a3b8;text-decoration:none;font-weight:500;">
          Chi tiết →
        </a>
        <a href="/orders/new?customer=${c.id}"
           style="font-size:12px;padding:4px 10px;border-radius:6px;background:#f97316;color:white;font-weight:600;text-decoration:none;">
          🛒 Tạo đơn
        </a>
      </div>
    </div>
  `
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MapView({ customers, selectedId, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  // ── Khởi tạo map một lần ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const defaultCenter: [number, number] = customers.length > 0
      ? [
          customers.reduce((s, c) => s + c.lat, 0) / customers.length,
          customers.reduce((s, c) => s + c.lng, 0) / customers.length,
        ]
      : [10.762622, 106.660172]

    const map = L.map(containerRef.current, { zoomControl: true }).setView(defaultCenter, 13)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    // Hiển thị label khi zoom >= 14
    const refreshIcons = () => {
      const zoom = map.getZoom()
      markersRef.current.forEach((marker, id) => {
        const c = customers.find(x => x.id === id)
        if (c) marker.setIcon(makeIcon(c, id === selectedId, zoom >= 14))
      })
    }
    map.on('zoomend', refreshIcons)

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cập nhật markers khi customers thay đổi ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Xoá markers cũ
    markersRef.current.forEach(m => m.remove())
    markersRef.current.clear()

    if (customers.length === 0) return

    const zoom = map.getZoom()

    customers.forEach(c => {
      const isSelected = c.id === selectedId
      const marker = L.marker([c.lat, c.lng], {
        icon: makeIcon(c, isSelected, zoom >= 14),
      })
        .addTo(map)
        .bindPopup(buildPopupHTML(c), { maxWidth: 280 })
        .on('click', () => onSelect(c.id))

      markersRef.current.set(c.id, marker)
    })

    // FitBounds khi load (không có selectedId)
    if (!selectedId) {
      const bounds = L.latLngBounds(customers.map(c => [c.lat, c.lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers])

  // ── FlyTo + openPopup khi selectedId thay đổi ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const zoom = map.getZoom()

    // Reset tất cả icons về normal
    markersRef.current.forEach((marker, id) => {
      const c = customers.find(x => x.id === id)
      if (c) marker.setIcon(makeIcon(c, id === selectedId, zoom >= 14))
    })

    if (selectedId) {
      const marker = markersRef.current.get(selectedId)
      const c = customers.find(x => x.id === selectedId)
      if (marker && c) {
        map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 16), { duration: 1 })
        setTimeout(() => marker.openPopup(), 900)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return (
    <div ref={containerRef} className="w-full h-full z-0" />
  )
}
