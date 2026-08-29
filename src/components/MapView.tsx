'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { ShoppingCart, Phone, MapPin, ArrowRight } from 'lucide-react'
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

function getMarkerIcon(c: CustomerMapItem, isSelected: boolean) {
  let color = '#10b981' // green default
  if (c.debtBalance > 0) color = '#eab308' // yellow for debt
  if (c.urgencyScore >= 50) color = '#ef4444' // red for urgent gas
  if (c.gasCylinderQty > 0 && color === '#10b981') color = '#3b82f6' // blue for cylinder hold

  const size = isSelected ? 36 : 28
  const borderSize = isSelected ? 3 : 2

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: ${borderSize}px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: ${isSelected ? '14px' : '11px'};
      font-weight: bold;
      cursor: pointer;
      transform: translate(-50%, -50%);
      transition: all 0.2s ease;
    ">
      ${c.name.charAt(0).toUpperCase()}
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-customer-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

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

export default function MapView({ customers, selectedId, onSelect }: MapViewProps) {
  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedId),
    [customers, selectedId]
  )

  // Center default (Vietnam or center of points)
  const defaultCenter: [number, number] = useMemo(() => {
    if (customers.length > 0) {
      const avgLat = customers.reduce((s, c) => s + c.lat, 0) / customers.length
      const avgLng = customers.reduce((s, c) => s + c.lng, 0) / customers.length
      return [avgLat, avgLng]
    }
    return [10.762622, 106.660172] // Default TP.HCM / South VN
  }, [customers])

  return (
    <div className="w-full h-full min-h-[450px] relative bg-slate-900">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', minHeight: '450px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController customers={customers} selectedCustomer={selectedCustomer} />

        {customers.map(c => {
          const isSelected = c.id === selectedId
          const icon = getMarkerIcon(c, isSelected)

          return (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onSelect(c.id),
              }}
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

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/50 text-xs">
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                    >
                      Chi tiết <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href={`/orders/new?customer=${c.id}`}
                      className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-medium flex items-center gap-1"
                    >
                      <ShoppingCart className="w-3 h-3" /> Đặt hàng
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
