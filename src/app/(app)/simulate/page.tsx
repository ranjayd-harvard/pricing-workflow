'use client'

import { useEffect, useState } from 'react'
import { Send, Zap, ChevronDown, Info } from 'lucide-react'
import { PricingTemplate } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

export default function SimulatePage() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<PricingTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<PricingTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null)

  const [form, setForm] = useState({
    from: 'John Smith <john@example.com>',
    to: '',
    subject: 'Pricing Update Request',
    body: '',
  })

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(j => {
      if (j.success) {
        setTemplates(j.data)
        if (j.data.length) setSelectedTemplate(j.data[0])
      }
    })
  }, [])

  const fieldPlaceholder = (f: { type: string; example?: string; label: string }) => {
    if (f.example) return f.example
    if (f.type === 'currency') return '$0.00'
    if (f.type === 'number') return '0'
    if (f.type === 'date') return 'YYYY-MM-DD'
    return `[${f.label}]`
  }

  useEffect(() => {
    if (!selectedTemplate) return
    const mandatory = selectedTemplate.mandatoryFields
    const optional = selectedTemplate.optionalFields || []
    const lines = [
      `Hi,\n\nI would like to request a pricing update. Please find the details below:\n`,
      ...mandatory.map(f => `${f.label}: ${fieldPlaceholder(f)}`),
    ]
    if (optional.length) {
      lines.push('')
      lines.push('Additional details:')
      optional.forEach(f => lines.push(`${f.label}: ${fieldPlaceholder(f)}`))
    }
    lines.push(`\nPlease process this request at your earliest convenience.\n\nThank you,\nJohn Smith`)
    setForm(prev => ({
      ...prev,
      to: selectedTemplate.targetEmail,
      body: lines.join('\n'),
      subject: `Pricing Update Request — ${selectedTemplate.name}`,
    }))
  }, [selectedTemplate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/emails/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: form.from,
          to: form.to,
          subject: form.subject,
          body: form.body,
        }),
      })
      const json = await res.json()
      setResult(json)
      if (json.success) toast('success', json.message || 'Email processed!')
      else toast('error', json.error || 'Failed to process email')
    } finally {
      setLoading(false)
    }
  }

  const stripFieldFromBody = (fieldLabel: string) => {
    const lines = form.body.split('\n')
    const filtered = lines.filter(l => !l.toLowerCase().startsWith(fieldLabel.toLowerCase() + ':'))
    setForm(prev => ({ ...prev, body: filtered.join('\n') }))
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Simulate Email</h1>
        <p className="text-slate-500 text-sm mt-1">
          Test the workflow by simulating an inbound pricing request email
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card p-6 space-y-5">
            {/* Template selector */}
            <div>
              <label className="label">Select Template *</label>
              <div className="relative">
                <select
                  className="input w-full appearance-none pr-8"
                  value={selectedTemplate?._id || ''}
                  onChange={e => {
                    const t = templates.find(t => t._id === e.target.value)
                    setSelectedTemplate(t || null)
                  }}
                >
                  <option value="">— Select a template —</option>
                  {templates.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {!templates.length && (
                <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                  <Info className="w-3 h-3" /> No active templates. Create one in the Templates section first.
                </p>
              )}
            </div>

            {/* From */}
            <div>
              <label className="label">From (Sender)</label>
              <input
                className="input w-full text-sm"
                placeholder='John Smith <john@example.com>'
                value={form.from}
                onChange={e => setForm(p => ({ ...p, from: e.target.value }))}
              />
            </div>

            {/* To */}
            <div>
              <label className="label">To (Destination)</label>
              <input
                className="input w-full text-sm font-mono"
                placeholder="ranjayflash@gmail.com"
                value={form.to}
                onChange={e => setForm(p => ({ ...p, to: e.target.value }))}
              />
            </div>

            {/* Subject */}
            <div>
              <label className="label">Subject</label>
              <input
                className="input w-full text-sm"
                placeholder="Pricing Update Request"
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              />
            </div>

            {/* Body */}
            <div>
              <label className="label">Email Body</label>
              <textarea
                className="input w-full text-sm font-mono resize-none"
                rows={14}
                placeholder="Type your email body here..."
                value={form.body}
                onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !selectedTemplate}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Zap className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Simulated Email</>
              )}
            </button>
          </form>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Template fields */}
          {selectedTemplate && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-3">
                Fields — <span className="text-brand-600">{selectedTemplate.name}</span>
              </h3>

              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Mandatory</p>
              <div className="space-y-2 mb-4">
                {selectedTemplate.mandatoryFields.map(f => (
                  <div key={f.key} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{f.label}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{f.key} · {f.type}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => stripFieldFromBody(f.label)}
                      className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                      title="Remove from body to test missing-field validation"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>

              {(selectedTemplate.optionalFields || []).length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Optional</p>
                  <div className="space-y-2 mb-3">
                    {(selectedTemplate.optionalFields || []).map(f => (
                      <div key={f.key} className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-slate-600">{f.label}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{f.key} · {f.type}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => stripFieldFromBody(f.label)}
                          className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                          title="Remove from body"
                        >
                          remove
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p className="text-[10px] text-slate-600 italic">
                Click "remove" to test missing-field validation
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={cn('card p-5 border', result.success ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50')}>
              <h3 className={cn('font-semibold text-sm mb-2', result.success ? 'text-emerald-400' : 'text-red-400')}>
                {result.success ? '✅ Processed' : '❌ Failed'}
              </h3>
              <p className="text-xs text-slate-700 mb-3">{result.message}</p>
              {result.data != null && (
                <pre className="text-[10px] font-mono text-slate-600 bg-surface rounded p-2 overflow-auto max-h-48">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* How it works */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">How It Works</h3>
            <ol className="space-y-2.5 text-xs text-slate-600">
              {[
                'Email arrives at the designated address',
                'System checks all mandatory fields are present',
                'If missing → reply email sent to requester',
                'If complete → Gemini AI summarizes & extracts data',
                'Data mapped to pricing template JSON',
                'Request queued for manual approval',
                'On approval → external pricing API called',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-brand-600/30 text-brand-400 text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
