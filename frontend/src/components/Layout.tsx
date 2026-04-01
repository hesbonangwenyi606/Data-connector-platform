'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Database,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Table2,
  Users,
  X,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { FullPageSpinner } from './Spinner'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Connections', href: '/connections', icon: Database },
  { label: 'Extract', href: '/extract', icon: Table2 },
  { label: 'Files', href: '/files', icon: FileText },
  { label: 'Users', href: '/users', icon: Users, adminOnly: true },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) return <FullPageSpinner />
  if (!user) return null

  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || user.role === 'admin'
  )

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {visibleNavItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            )}
          >
            <Icon
              size={18}
              className={cn(
                'flex-shrink-0 transition-colors',
                isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
              )}
            />
            {item.label}
            {isActive && <ChevronRight size={14} className="ml-auto text-blue-200" />}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-64 bg-slate-800 text-white transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Download size={16} className="text-white" />
            </div>
            <span className="font-bold text-white text-base">DataConnector</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded lg:hidden text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <NavLinks />

        {/* User section */}
        <div className="p-3 border-t border-slate-700">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            {user.role === 'admin' && (
              <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">
                Admin
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <LogOut size={16} className="text-slate-400" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">DataConnector</span>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="text-slate-700 font-medium capitalize">
              {pathname === '/' ? 'Dashboard' : pathname.slice(1)}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium">{user.username}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
