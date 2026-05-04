'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  Mail,
  Settings,
  Zap,
  ChevronRight,
  Package,
  CalendarDays,
  MessageCircle,
  ImageUp,
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

  return (
    <aside className="w-64 min-h-screen bg-surface-card border-r border-surface-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-tight text-sm">Pricing</div>
            <div className="font-bold text-slate-900 leading-tight text-sm">Workflow</div>
          </div>
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
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500">
          <Settings className="w-3.5 h-3.5" />
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  )
}
