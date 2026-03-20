import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

import { SidebarProvider } from '@/components/SidebarProvider'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <SidebarProvider>
      <div className="flex min-h-screen relative overflow-hidden bg-slate-950">
        <Sidebar />
        <div className="flex-1 flex flex-col w-full md:ml-60 min-h-screen transition-all duration-300">
          {children}
        </div>
      </div>
    </SidebarProvider>
  )
}
