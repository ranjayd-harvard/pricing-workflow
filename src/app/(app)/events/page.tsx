'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { RefreshCw, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PriceHistory {
  old_price: number
  new_price: number
  changed_at: string
  queue_id: string
}

interface Event {
  _id: string
  event_id: string
  event_name: string
  current_price: number
  new_price: number
  effective_date?: string
  reason?: string
  sponsor?: string
  notes?: string
  last_updated_by: string
  last_queue_id: string
  price_history: PriceHistory[]
  createdAt: string
  updatedAt: string
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/events')
      const json = await res.json()
      if (json.success) setEvents(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [])

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="text-slate-500 text-sm mt-1">Event pricing table — updated on approval</p>
        </div>
        <button onClick={fetchEvents} disabled={loading} className="flex items-center gap-2 btn-secondary text-sm">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-slate-500 text-sm">Loading...</div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 text-sm">
          <CalendarDays className="w-8 h-8 mx-auto mb-3 opacity-30" />
          No events yet. Approve an event pricing request to populate this table.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left p-4">Event ID</th>
                <th className="text-left p-4">Event Name</th>
                <th className="text-right p-4">Current Price</th>
                <th className="text-left p-4">Effective Date</th>
                <th className="text-left p-4">Sponsor</th>
                <th className="text-left p-4">Reason</th>
                <th className="text-left p-4">Last Updated By</th>
                <th className="text-left p-4">Updated At</th>
                <th className="text-left p-4">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {events.map(event => (
                <>
                  <tr key={event._id} className="hover:bg-surface-hover transition-colors">
                    <td className="p-4 font-mono text-brand-400 font-medium">{event.event_id}</td>
                    <td className="p-4 text-slate-800">{event.event_name}</td>
                    <td className="p-4 text-right text-emerald-700 font-semibold">
                      ${Number(event.current_price).toFixed(2)}
                    </td>
                    <td className="p-4 text-slate-700">{event.effective_date || '—'}</td>
                    <td className="p-4 text-slate-600">{event.sponsor || '—'}</td>
                    <td className="p-4 text-slate-600 max-w-[180px] truncate" title={event.reason}>{event.reason || '—'}</td>
                    <td className="p-4 text-slate-600 text-xs">{event.last_updated_by}</td>
                    <td className="p-4 text-slate-500 text-xs">
                      {format(new Date(event.updatedAt), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="p-4">
                      {event.price_history.length > 0 && (
                        <button
                          onClick={() => setExpandedId(expandedId === event.event_id ? null : event.event_id)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          {event.price_history.length} entries
                          {expandedId === event.event_id
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === event.event_id && event.price_history.length > 0 && (
                    <tr key={`${event._id}-history`}>
                      <td colSpan={9} className="bg-surface px-4 pb-4 pt-0">
                        <div className="rounded-lg border border-surface-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-surface-border text-slate-600 uppercase tracking-wider">
                                <th className="text-left p-3">Date</th>
                                <th className="text-right p-3">Old Price</th>
                                <th className="text-right p-3">New Price</th>
                                <th className="text-left p-3">Queue ID</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-border">
                              {[...event.price_history].reverse().map((h, i) => (
                                <tr key={i}>
                                  <td className="p-3 text-slate-600">{format(new Date(h.changed_at), 'MMM d, yyyy HH:mm')}</td>
                                  <td className="p-3 text-right text-red-600">${Number(h.old_price).toFixed(2)}</td>
                                  <td className="p-3 text-right text-emerald-700">${Number(h.new_price).toFixed(2)}</td>
                                  <td className="p-3 text-slate-500 font-mono">{h.queue_id}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
