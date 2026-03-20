'use client'

import { useSession } from 'next-auth/react'
import { Bell, Search, Menu } from 'lucide-react'
import { useSidebar } from '@/components/SidebarProvider'

interface HeaderProps {
  title: string
  subtitle?: string
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()
  const { setIsOpen } = useSidebar()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 gap-4">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg md:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base md:text-lg font-semibold text-slate-100 line-clamp-1">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search hint */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-slate-600 transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Tìm kiếm...</span>
          <kbd className="ml-2 px-1.5 py-0.5 bg-slate-700 rounded text-xs">Ctrl+K</kbd>
        </div>

        {/* Alerts */}
        <button className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full" />
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {session?.user?.name?.charAt(0) ?? 'A'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-200">{session?.user?.name ?? 'Admin'}</p>
            <p className="text-xs text-slate-500">{session?.user?.role ?? 'admin'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
