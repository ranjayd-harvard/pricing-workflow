'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ArrowLeft, CheckCircle, XCircle, RefreshCw,
  Mail, FileText, Zap, Database, Clock,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { PricingQueueItem, QueueStatus } from '@/types'
import { cn } from '@/lib/utils'

export default function QueueItemPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [item, setItem] = useState<PricingQueueItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showThread, setShowThread] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const fetchItem = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/queue/${id}`)
      const json = await res.json()
      if (json.success) setItem(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItem() }, [id])

  const handleApprove = async () => {
    setActionLoading('approve')
    try {
      const res = await fetch(`/api/queue/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvedBy: 'admin' }) })
      const json = await res.json()
      if (json.success) {
        toast('success', json.message || 'Request approved!')
        fetchItem()
      } else {
        toast('error', json.error || 'Failed to approve')
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    setActionLoading('reject')
    try {
      const res = await fetch(`/api/queue/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectedBy: 'admin', reason: rejectReason }),
      })
      const json = await res.json()
      if (json.success) {
        toast('success', 'Request rejected')
        setShowRejectForm(false)
        fetchItem()
      } else {
        toast('error', json.error || 'Failed to reject')
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleResummarize = async () => {
    setActionLoading('summarize')
    try {
      const res = await fetch(`/api/queue/${id}/summarize`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        toast('success', 'Re-summarized successfully')
        fetchItem()
      } else {
        toast('error', json.error || 'Failed to re-summarize')
      }
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Request not found.</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4 text-sm">Go back</button>
      </div>
    )
  }

  const canApprove = item.status === 'pending_approval'
  const canResummarize = ['pending_info', 'pending_approval', 'summarized', 'mapped', 'failed'].includes(item.status)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <button onClick={() => router.back()} className="mt-1 text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">{item.subject}</h1>
            <StatusBadge status={item.status as QueueStatus} />
          </div>
          <p className="text-slate-500 text-sm mt-1">
            From <span className="text-slate-700">{item.requesterEmail}</span>
            {item.createdAt && ` · ${formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}`}
            {' · '} Template: <span className="text-slate-700">{item.templateName}</span>
          </p>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canResummarize && (
            <button onClick={handleResummarize} disabled={!!actionLoading}
              className="btn-secondary text-sm flex items-center gap-2">
              <Zap className={cn('w-4 h-4', actionLoading === 'summarize' && 'animate-spin')} />
              Re-analyze
            </button>
          )}
          {canApprove && (
            <>
              <button onClick={() => setShowRejectForm(v => !v)} disabled={!!actionLoading}
                className="btn-danger text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button onClick={handleApprove} disabled={!!actionLoading}
                className="btn-success text-sm flex items-center gap-2">
                <CheckCircle className={cn('w-4 h-4', actionLoading === 'approve' && 'animate-spin')} />
                Approve & Update
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reject form */}
      {showRejectForm && (
        <div className="card p-4 mb-6 border border-red-300 bg-red-50">
          <p className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Reject Request
          </p>
          <textarea
            className="input w-full text-sm h-20 resize-none mb-3"
            placeholder="Reason for rejection (optional, will be sent to requester)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleReject} disabled={!!actionLoading} className="btn-danger text-sm">
              {actionLoading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
            </button>
            <button onClick={() => setShowRejectForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* API result */}
      {item.apiCallResult && (
        <div className={cn('card p-4 mb-6 border', item.apiCallResult.success ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50')}>
          <p className={cn('text-sm font-medium mb-1', item.apiCallResult.success ? 'text-emerald-400' : 'text-red-400')}>
            {item.apiCallResult.success ? '✅ Price API call successful' : '❌ Price API call failed'}
          </p>
          {item.apiCallResult.error && <p className="text-xs text-red-400">{item.apiCallResult.error}</p>}
          {item.apiCallResult.calledAt && <p className="text-xs text-slate-500 mt-1">Called at {format(new Date(item.apiCallResult.calledAt), 'PPpp')}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Missing fields */}
        {item.missingFields.length > 0 && (
          <div className="lg:col-span-2 card p-5 border border-amber-300 bg-amber-50">
            <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Missing Mandatory Fields
            </h3>
            <div className="flex flex-wrap gap-2">
              {item.missingFields.map(f => (
                <span key={f} className="badge bg-amber-100 text-amber-800 border border-amber-300">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {item.summary && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" /> AI Summary
            </h3>
            <p className="text-slate-700 text-sm leading-relaxed">{item.summary}</p>
          </div>
        )}

        {/* Extracted Data */}
        {item.extractedData && Object.keys(item.extractedData).length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" /> Extracted Data
            </h3>
            <div className="space-y-2">
              {Object.entries(item.extractedData).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-slate-800 font-mono text-xs bg-surface px-2 py-0.5 rounded">
                    {v === null ? <span className="text-slate-400">null</span> : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mapped Data — fall back to extractedData if mappedData is empty */}
        {(() => {
          const payload = (item.mappedData && Object.keys(item.mappedData).length > 0)
            ? item.mappedData
            : (item.extractedData && Object.keys(item.extractedData).length > 0)
              ? item.extractedData
              : null
          const isFallback = payload === item.extractedData
          return payload ? (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-400" />
                Mapped Pricing Payload
                {isFallback && <span className="text-xs text-amber-500 font-normal">(from extracted data)</span>}
              </h3>
              <pre className="text-xs text-slate-700 bg-surface rounded-lg p-3 overflow-auto max-h-48 font-mono leading-relaxed">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          ) : null
        })()}

        {/* Original Email */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" /> Original Email Body
          </h3>
          <pre className="text-xs text-slate-300 bg-surface rounded-lg p-3 overflow-auto max-h-48 font-mono leading-relaxed whitespace-pre-wrap">
            {item.originalEmailBody}
          </pre>
        </div>

        {/* Email thread */}
        {item.emailThread.length > 1 && (
          <div className="card lg:col-span-2">
            <button
              onClick={() => setShowThread(v => !v)}
              className="w-full flex items-center justify-between p-5 text-sm font-medium text-slate-800 hover:text-slate-900"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Email Thread ({item.emailThread.length} messages)
              </span>
              {showThread ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showThread && (
              <div className="border-t border-surface-border divide-y divide-surface-border">
                {item.emailThread.map((msg, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">From: <span className="text-slate-700">{msg.from}</span></span>
                      <span className="text-xs text-slate-500">{format(new Date(msg.timestamp), 'PPpp')}</span>
                    </div>
                    <pre className="text-xs text-slate-700 bg-surface rounded p-3 whitespace-pre-wrap max-h-32 overflow-auto font-mono">{msg.body}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approval/rejection info */}
        {(item.approvedAt || item.rejectedAt) && (
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold text-slate-800 mb-3">Decision Record</h3>
            {item.approvedAt && (
              <p className="text-sm text-slate-700">
                ✅ Approved by <strong>{item.approvedBy}</strong> on {format(new Date(item.approvedAt), 'PPpp')}
              </p>
            )}
            {item.rejectedAt && (
              <>
                <p className="text-sm text-slate-700">
                  ❌ Rejected by <strong>{item.rejectedBy}</strong> on {format(new Date(item.rejectedAt), 'PPpp')}
                </p>
                {item.rejectionReason && <p className="text-sm text-slate-600 mt-1">Reason: {item.rejectionReason}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
