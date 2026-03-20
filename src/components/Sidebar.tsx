'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  Truck,
  BarChart3,
  LogOut,
  Flame,
  ChevronRight,
  UserCog,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/SidebarProvider'
import { useEffect } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Khách Hàng', icon: Users },
  { href: '/orders', label: 'Đơn Hàng', icon: ShoppingCart },
  { href: '/inventory', label: 'Kho Hàng', icon: Package },
  { href: '/purchases', label: 'Nhập Hàng', icon: Truck },
  { href: '/reports', label: 'Báo Cáo', icon: BarChart3 },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isOpen, setIsOpen } = useSidebar()

  // Close sidebar on route change on mobile
  useEffect(() => {
    setIsOpen(false)
  }, [pathname, setIsOpen])

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-screen w-60 bg-slate-900/95 border-r border-slate-700/50 backdrop-blur-xl flex flex-col transition-transform duration-300 z-50",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-100 text-sm leading-tight">Gas & Gạo</p>
            <p className="text-xs text-slate-500">Quản lý cửa hàng</p>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="md:hidden p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'nav-active'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-300')} />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 text-orange-500" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-700/50 space-y-0.5">
        {/* Account link */}
        <Link
          href="/account"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
            pathname === '/account'
              ? 'nav-active'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          )}
        >
          <UserCog className={cn('w-4 h-4 flex-shrink-0', pathname === '/account' ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-300')} />
          <span className="flex-1">Tài Khoản</span>
          {pathname === '/account' && <ChevronRight className="w-3 h-3 text-orange-500" />}
        </Link>
        {/* Logout button */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất</span>
        </button>
      </div>
      </aside>
    </>
  )
}
