'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  Mail,
  Settings,
  ChevronRight,
  Package,
  CalendarDays,
  MessageCircle,
  ImageUp,
  LogOut,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/queue', label: 'Approval Queue', icon: ListChecks },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/simulate', label: 'Simulate Email', icon: Mail },
  { href: '/upload', label: 'Upload Image', icon: ImageUp },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = session?.user.role === 'admin'

  return (
    <aside className="w-64 min-h-screen bg-surface-card border-r border-surface-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Pricing Workflow" className="h-9" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-surface-hover'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-brand-700' : 'text-slate-500 group-hover:text-slate-700')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 text-brand-700" />}
            </Link>
          )
        })}
        {isAdmin && (() => {
          const active = pathname === '/admin' || pathname.startsWith('/admin/')
          return (
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-surface-hover'
              )}
            >
              <Shield className={cn('w-4 h-4 flex-shrink-0', active ? 'text-brand-700' : 'text-slate-500 group-hover:text-slate-700')} />
              <span className="flex-1">User Management</span>
              {active && <ChevronRight className="w-3 h-3 text-brand-700" />}
            </Link>
          )
        })()}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-border space-y-1">
        {session?.user && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-600 truncate">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <span className="text-brand-700 font-semibold text-[10px]">
                  {session.user.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <span className="truncate">{session.user.name ?? session.user.email}</span>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400">
          <Settings className="w-3.5 h-3.5" />
          <span>v1.3.0</span>
        </div>
      </div>
    </aside>
  )
}
