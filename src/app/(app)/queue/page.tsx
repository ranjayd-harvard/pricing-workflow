'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, Search, Filter, ChevronRight } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import { PricingQueueItem, QueueStatus } from '@/types'
import { cn } from '@/lib/utils'

const ALL_STATUSES: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_info', label: 'Pending Info' },
  { value: 'pending_approval', label: 'Needs Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'price_updated', label: 'Price Updated' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
]

export default function QueuePage() {
  const [items, setItems] = useState<PricingQueueItem[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/queue?${params}`)
      const json = await res.json()
      if (json.success) {
        setItems(json.data.items)
        setStats(json.data.stats)
        setTotal(json.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { fetch_() }, [fetch_])

  const filtered = items.filter(i =>
    !search ||
    i.subject.toLowerCase().includes(search.toLowerCase()) ||
    i.requesterEmail.toLowerCase().includes(search.toLowerCase()) ||
    i.templateName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Approval Queue</h1>
          <p className="text-slate-500 text-sm mt-1">{total} total requests</p>
        </div>
        <button onClick={fetch_} disabled={loading} className="flex items-center gap-2 btn-secondary text-sm">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search subject, email, template..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input w-full pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-surface-card border border-surface-border rounded-lg p-1 flex-wrap">
          {ALL_STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatus(s.value)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                status === s.value
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-surface-hover'
              )}>
              {s.label}
              {s.value !== 'all' && stats[s.value] ? (
                <span className="ml-1.5 bg-slate-200 text-slate-700 rounded-full px-1.5 py-0.5 text-[10px]">
                  {stats[s.value]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Subject', 'Requester', 'Template', 'Status', 'Created', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
              ) : !filtered.length ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No requests found</td></tr>
              ) : filtered.map(item => (
                <tr key={item._id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 max-w-xs truncate">{item.subject}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.requesterEmail}</td>
                  <td className="px-4 py-3 text-slate-600">{item.templateName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status as QueueStatus} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/queue/${item._id}`} className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-xs">
                      Review <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
