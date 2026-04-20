'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  CheckCircle, Clock, XCircle, AlertCircle,
  FileText, RefreshCw, ArrowRight,
  Mail, Package, CalendarDays, Layers,
  MessageSquare, ShieldCheck, Inbox,
} from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import { PricingQueueItem, QueueStatus } from '@/types'
import { cn } from '@/lib/utils'

interface TemplateInfo {
  _id: string
  name: string
  targetCollection: string
  active: boolean
}

interface DashboardData {
  stats: Record<string, number>
  total: number
  activeTemplates: number
  templates: TemplateInfo[]
  recentItems: PricingQueueItem[]
}

const collectionIcon: Record<string, React.ElementType> = {
  products: Package,
  events: CalendarDays,
  generic: Layers,
}

const collectionColor: Record<string, string> = {
  products: 'text-blue-600 bg-blue-50 border-blue-200',
  events: 'text-violet-600 bg-violet-50 border-violet-200',
  generic: 'text-slate-600 bg-slate-50 border-slate-200',
}

function SectionHeader({ icon: Icon, title, linkHref, linkLabel }: {
  icon: React.ElementType
  title: string
  linkHref?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" />
        <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{title}</h2>
      </div>
      {linkHref && (
        <Link href={linkHref} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
          {linkLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, bg, border, loading }: {
  label: string; value: number; icon: React.ElementType
  color: string; bg: string; border: string; loading: boolean
}) {
  return (
    <div className={cn('card p-5 border', border)}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className={cn('text-2xl font-bold', color)}>{loading ? '—' : value}</div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      if (json.success) setData(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const s = (key: string) => data?.stats[key] ?? 0

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Pricing workflow overview</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 btn-secondary text-sm">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* ── SECTION 1: Templates ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={FileText} title="Templates" linkHref="/templates" linkLabel="Manage templates" />
        {loading ? (
          <div className="card p-6 text-center text-slate-500 text-sm">Loading...</div>
        ) : !data?.templates?.length ? (
          <div className="card p-6 text-center text-slate-500 text-sm">
            No templates yet. <Link href="/templates" className="text-brand-400 hover:underline">Create one →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.templates.map(t => {
              const Icon = collectionIcon[t.targetCollection] || Layers
              const colorClass = collectionColor[t.targetCollection] || collectionColor.generic
              return (
                <div key={t._id} className={cn('card p-4 border flex items-start gap-3', !t.active && 'opacity-50')}>
                  <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0', colorClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">
                      → {t.targetCollection} {!t.active && '· inactive'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── SECTION 2: Emails (in-flight) ────────────────────────────────────── */}
      <section>
        <SectionHeader icon={Inbox} title="Emails" linkHref="/queue" linkLabel="View queue" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label="Total Requests" value={data?.total ?? 0} icon={Mail}
            color="text-brand-700" bg="bg-brand-50" border="border-brand-200" loading={loading} />
          <StatCard label="Needs Clarification" value={s('pending_clarification')} icon={MessageSquare}
            color="text-violet-700" bg="bg-violet-50" border="border-violet-200" loading={loading} />
          <StatCard label="Awaiting Info" value={s('pending_info')} icon={AlertCircle}
            color="text-amber-700" bg="bg-amber-50" border="border-amber-200" loading={loading} />
          <StatCard label="Processing" value={s('pending_summary') + s('summarized') + s('mapped')} icon={Clock}
            color="text-blue-700" bg="bg-blue-50" border="border-blue-200" loading={loading} />
        </div>
      </section>

      {/* ── SECTION 3: Approvals ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={ShieldCheck} title="Approvals" linkHref="/queue" linkLabel="Review queue" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Pending Approval" value={s('pending_approval')} icon={Clock}
            color="text-orange-700" bg="bg-orange-50" border="border-orange-200" loading={loading} />
          <StatCard label="Price Updated" value={s('price_updated')} icon={CheckCircle}
            color="text-emerald-700" bg="bg-emerald-50" border="border-emerald-200" loading={loading} />
          <StatCard label="Rejected" value={s('rejected')} icon={XCircle}
            color="text-red-600" bg="bg-red-50" border="border-red-200" loading={loading} />
          <StatCard label="Failed" value={s('failed')} icon={AlertCircle}
            color="text-slate-600" bg="bg-slate-100" border="border-slate-200" loading={loading} />
        </div>

        {/* Recent activity */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
            <span className="text-sm font-medium text-slate-700">Recent Requests</span>
            <Link href="/queue" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading...</div>
          ) : !data?.recentItems?.length ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No requests yet. <Link href="/simulate" className="text-brand-400 hover:underline">Simulate one →</Link>
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {data.recentItems.map(item => (
                <Link key={item._id} href={`/queue/${item._id}`}
                  className="flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.requesterEmail} · {item.templateName}</p>
                  </div>
                  <StatusBadge status={item.status as QueueStatus} />
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
