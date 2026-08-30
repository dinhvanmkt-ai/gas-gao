'use client'

import { useEffect, useMemo } from 'react'
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

function getMarkerIcon(c: CustomerMapItem, isSelected: boolean) {
  let color = '#10b981' // green default
  if (c.debtBalance > 0) color = '#eab308' // yellow for debt
  if (c.urgencyScore >= 50) color = '#ef4444' // red for urgent gas
  if (c.gasCylinderQty > 0 && color === '#10b981') color = '#3b82f6' // blue for cylinder hold

  const size = isSelected ? 36 : 28

  const html = `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: ${size}px; height: ${size * 1.3}px;">
      <svg width="${size}" height="${size * 1.3}" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.4));">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 24 12 24s12-15.5 12-24c0-6.627-5.373-12-12-12zm0 17.5c-3.038 0-5.5-2.462-5.5-5.5S8.962 6.5 12 6.5s5.5 2.462 5.5 5.5-2.462 5.5-5.5 5.5z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
      <div class="custom-marker-label ${isSelected ? 'selected' : ''}">
        ${c.name}
      </div>
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

// MapEvents component to add class to map container based on zoom level
function MapEvents() {
  const map = useMap()
  
  useEffect(() => {
    const updateZoomClass = () => {
      const zoom = map.getZoom()
      if (zoom >= 14) {
        map.getContainer().classList.add('show-marker-labels')
      } else {
        map.getContainer().classList.remove('show-marker-labels')
      }
    }
    
    // Initial call
    updateZoomClass()
    
    // Listen to zoom changes
    map.on('zoomend', updateZoomClass)
    return () => {
      map.off('zoomend', updateZoomClass)
    }
  }, [map])
  
  return null
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
        <MapEvents />

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
