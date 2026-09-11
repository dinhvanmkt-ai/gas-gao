'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { ShoppingCart, Phone, MapPin, ArrowRight, Navigation } from 'lucide-react'
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

// ─── Marker icon: pin only (no HTML label) ────────────────────────────────────
function getMarkerIcon(c: CustomerMapItem, isSelected: boolean) {
  let color = '#10b981'
  if (c.debtBalance > 0) color = '#eab308'
  if (c.urgencyScore >= 50) color = '#ef4444'
  if (c.gasCylinderQty > 0 && color === '#10b981') color = '#3b82f6'

  const size = isSelected ? 36 : 28

  const html = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size * 1.3}px;">
      <svg width="${size}" height="${size * 1.3}" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"
           style="filter:drop-shadow(0px 3px 4px rgba(0,0,0,0.4));">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 24 12 24s12-15.5 12-24c0-6.627-5.373-12-12-12zm0 17.5c-3.038 0-5.5-2.462-5.5-5.5S8.962 6.5 12 6.5s5.5 2.462 5.5 5.5-2.462 5.5-5.5 5.5z"
              fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-pin-container',
    iconSize: [size, size * 1.3],
    iconAnchor: [size / 2, size * 1.3],
    popupAnchor: [0, -(size * 1.3)],
  })
}

function getMarkerColor(c: CustomerMapItem): string {
  if (c.urgencyScore >= 50) return '#ef4444'
  if (c.debtBalance > 0) return '#eab308'
  if (c.gasCylinderQty > 0) return '#3b82f6'
  return '#10b981'
}

// ─── Label display constants ──────────────────────────────────────────────────
const FONT_SIZE = 11
const LABEL_PAD_X = 7
const LABEL_PAD_Y = 3
const LABEL_H = FONT_SIZE + LABEL_PAD_Y * 2   // 17px
const PIN_OFFSET_Y = 8    // gap between label bottom and marker tip (px)
const LABEL_MIN_ZOOM = 14

// Priority score — higher = shown first when space is limited
function getPriority(c: CustomerMapItem): number {
  if (c.urgencyScore >= 50) return 4
  if (c.debtBalance > 0) return 3
  if (c.gasCylinderQty > 0) return 2
  return 1
}

// ─── SVG Label Overlay ────────────────────────────────────────────────────────
// Strategy:
//   1. Only process markers currently inside the map viewport (bounds check)
//   2. Label is anchored directly above its own marker — never pushed away
//   3. If labels overlap by >50% width → hide the lower-priority one
//   4. Selected label always visible, always rendered last (on top)
function LabelOverlay({
  customers,
  selectedId,
}: {
  customers: CustomerMapItem[]
  selectedId: string | null
}) {
  const map = useMap()
  const [tick, setTick] = useState(0)

  const forceUpdate = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    map.on('zoom', forceUpdate)
    map.on('move', forceUpdate)
    map.on('zoomend', forceUpdate)
    map.on('moveend', forceUpdate)
    return () => {
      map.off('zoom', forceUpdate)
      map.off('move', forceUpdate)
      map.off('zoomend', forceUpdate)
      map.off('moveend', forceUpdate)
    }
  }, [map, forceUpdate])

  const svgNodes = useMemo(() => {
    const zoom = map.getZoom()
    // Show labels at zoom >= 14, or always show selected
    if (zoom < LABEL_MIN_ZOOM && !selectedId) return null

    const bounds = map.getBounds()

    // ── Step 1: Filter to viewport only ──────────────────────────────────────
    // Always include selectedId even if off-screen (flyTo will bring it in view)
    const viewport = customers.filter(c => {
      if (c.id === selectedId) return true
      if (zoom < LABEL_MIN_ZOOM) return false
      return bounds.contains([c.lat, c.lng])
    })

    if (viewport.length === 0) return null

    // ── Step 2: Sort by priority (highest first; selected always first) ───────
    const sorted = [...viewport].sort((a, b) => {
      if (a.id === selectedId) return -1
      if (b.id === selectedId) return 1
      return getPriority(b) - getPriority(a)
    })

    // ── Step 3: Compute pixel positions (label anchored above its own marker) ─
    type LabelEntry = {
      c: CustomerMapItem
      isSelected: boolean
      mx: number; my: number   // marker tip (container pixel)
      lx: number; ly: number   // label top-left
      lw: number; lh: number
    }

    const approxTextW = (text: string) => text.length * 7 + LABEL_PAD_X * 2

    const entries: LabelEntry[] = []
    for (const c of sorted) {
      const isSelected = c.id === selectedId
      try {
        const pt = map.latLngToContainerPoint(L.latLng(c.lat, c.lng))
        const lw = approxTextW(c.name)
        const lh = isSelected ? LABEL_H + 2 : LABEL_H
        entries.push({
          c, isSelected,
          mx: pt.x, my: pt.y,
          lx: pt.x - lw / 2,
          ly: pt.y - PIN_OFFSET_Y - lh,   // directly above marker
          lw, lh,
        })
      } catch { /* skip if conversion fails */ }
    }

    // ── Step 4: Overlap visibility — hide, don't push ─────────────────────────
    // We iterate in priority order. Each entry occupies a "slot".
    // If a new entry overlaps a slot by > 50% of its width → skip it.
    // Selected is always kept (we added it first).
    const slots: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    const visible: LabelEntry[] = []

    for (const e of entries) {
      if (e.isSelected) {
        // Selected always visible — add slot, render it
        slots.push({ x1: e.lx, y1: e.ly, x2: e.lx + e.lw, y2: e.ly + e.lh })
        visible.push(e)
        continue
      }

      const overlapFraction = (slot: (typeof slots)[0]) => {
        const ox = Math.min(e.lx + e.lw, slot.x2) - Math.max(e.lx, slot.x1)
        const oy = Math.min(e.ly + e.lh, slot.y2) - Math.max(e.ly, slot.y1)
        if (ox <= 0 || oy <= 0) return 0
        // fraction of this label's width that is covered
        return ox / e.lw
      }

      const blocked = slots.some(s => overlapFraction(s) > 0.5)
      if (!blocked) {
        slots.push({ x1: e.lx, y1: e.ly, x2: e.lx + e.lw, y2: e.ly + e.lh })
        visible.push(e)
      }
    }

    // ── Step 5: Build SVG nodes ───────────────────────────────────────────────
    // Draw order: lines → rects → texts (selected on top via array ordering)
    // Sort visible: non-selected first so selected renders on top
    visible.sort((a, b) => (a.isSelected ? 1 : 0) - (b.isSelected ? 1 : 0))

    const lines: React.ReactNode[] = []
    const rects: React.ReactNode[] = []
    const texts: React.ReactNode[] = []

    for (const e of visible) {
      const cx = e.lx + e.lw / 2
      const labelBottom = e.ly + e.lh
      const color = getMarkerColor(e.c)

      // Leader line: label bottom-center → marker tip
      lines.push(
        <line key={`l-${e.c.id}`}
          x1={cx} y1={labelBottom}
          x2={e.mx} y2={e.my}
          stroke="white"
          strokeWidth={e.isSelected ? 2 : 1.5}
          strokeOpacity={0.9}
          filter="url(#ll-shadow)"
        />
      )

      // Label background
      rects.push(
        <rect key={`r-${e.c.id}`}
          x={e.lx} y={e.ly}
          width={e.lw} height={e.lh}
          rx={4} ry={4}
          fill="white"
          fillOpacity={e.isSelected ? 0.97 : 0.92}
          stroke={e.isSelected ? color : '#cbd5e1'}
          strokeWidth={e.isSelected ? 1.5 : 0.8}
          filter="url(#ll-shadow)"
        />
      )

      // Label text
      texts.push(
        <text key={`t-${e.c.id}`}
          x={cx}
          y={e.ly + e.lh / 2 + FONT_SIZE * 0.36}
          textAnchor="middle"
          fontSize={e.isSelected ? FONT_SIZE + 1 : FONT_SIZE}
          fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif"
          fill={e.isSelected ? color : '#1e293b'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {e.c.name}
        </text>
      )
    }

    return { lines, rects, texts }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, customers, selectedId, map])

  if (!svgNodes) return null
  const { lines, rects, texts } = svgNodes

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 500 }}>
      <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="ll-shadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.55)" />
          </filter>
        </defs>
        {lines}
        {rects}
        {texts}
      </svg>
    </div>
  )
}

// ─── Map controller ───────────────────────────────────────────────────────────
function MapController({
  customers,
  selectedCustomer,
}: {
  customers: CustomerMapItem[]
  selectedCustomer?: CustomerMapItem
}) {
  const map = useMap()

  useEffect(() => {
    if (selectedCustomer) {
      map.flyTo([selectedCustomer.lat, selectedCustomer.lng], 16, { duration: 1 })
    } else if (customers.length > 0) {
      const bounds = L.latLngBounds(customers.map(c => [c.lat, c.lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    }
  }, [customers, selectedCustomer, map])

  return null
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function MapView({ customers, selectedId, onSelect }: MapViewProps) {
  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedId),
    [customers, selectedId]
  )

  const defaultCenter: [number, number] = useMemo(() => {
    if (customers.length > 0) {
      const avgLat = customers.reduce((s, c) => s + c.lat, 0) / customers.length
      const avgLng = customers.reduce((s, c) => s + c.lng, 0) / customers.length
      return [avgLat, avgLng]
    }
    return [10.762622, 106.660172]
  }, [customers])

  return (
    <div className="w-full h-full relative bg-slate-900 z-0">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController customers={customers} selectedCustomer={selectedCustomer} />

        {/* Floating label + leader line SVG overlay */}
        <LabelOverlay customers={customers} selectedId={selectedId} />

        {customers.map(c => {
          const isSelected = c.id === selectedId
          const icon = getMarkerIcon(c, isSelected)

          return (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={icon}
              eventHandlers={{ click: () => onSelect(c.id) }}
            >
              <Popup className="customer-map-popup">
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-700/50 pb-2 mb-2">
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{c.name}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <a href={`tel:${c.phone}`} className="hover:text-blue-400">{c.phone}</a>
                      </p>
                    </div>
                  </div>

                  {c.address && (
                    <p className="text-xs text-slate-300 flex items-start gap-1 mb-2">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                      <span>{c.address}</span>
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {c.debtBalance > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-medium">
                        Nợ: {formatCurrency(c.debtBalance)}
                      </span>
                    )}
                    {c.gasCylinderQty > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        Giữ {c.gasCylinderQty} vỏ
                      </span>
                    )}
                    {c.urgencyScore >= 50 && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">
                        Khẩn cấp: sắp mua
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-700/50 text-xs">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium flex items-center gap-1 transition-colors"
                      title="Mở chỉ đường trên Google Maps"
                    >
                      <Navigation className="w-3 h-3 text-blue-400" /> Chỉ đường
                    </a>
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-slate-400 hover:text-slate-200 font-medium flex items-center gap-0.5 px-1 py-1"
                    >
                      Chi tiết <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href={`/orders/new?customer=${c.id}`}
                      className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-medium flex items-center gap-1 transition-colors"
                    >
                      <ShoppingCart className="w-3 h-3" /> Tạo đơn
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
