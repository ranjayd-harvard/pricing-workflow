'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { PricingTemplate, TemplateField } from '@/types'
import { useToast } from '@/components/ui/Toast'

interface Props {
  template: PricingTemplate | null
  onClose: () => void
  onSaved: () => void
}

interface FieldRowProps {
  field: TemplateField
  idx: number
  isMandatory: boolean
  onUpdate: (idx: number, isMandatory: boolean, changes: Partial<TemplateField>) => void
  onRemove: (idx: number, isMandatory: boolean) => void
  onMove: (idx: number, isMandatory: boolean) => void
}

// Defined outside the parent component so React doesn't unmount/remount on every keystroke
function FieldRow({ field, idx, isMandatory, onUpdate, onRemove, onMove }: FieldRowProps) {
  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-border group">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isMandatory ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
          {isMandatory ? 'Mandatory' : 'Optional'}
        </span>
        <button
          type="button"
          onClick={() => onMove(idx, isMandatory)}
          className="text-[10px] text-slate-400 hover:text-brand-400 flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
          title={isMandatory ? 'Make optional' : 'Make mandatory'}
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" />
          </svg>
          {isMandatory ? 'Make optional' : 'Make mandatory'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">Field Key *</label>
          <input
            className="input w-full text-sm"
            placeholder="e.g. product_sku"
            value={field.key}
            onChange={e => onUpdate(idx, isMandatory, { key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
          />
          <p className="text-[10px] text-slate-400 mt-1">snake_case identifier used internally. Must be unique.</p>
        </div>
        <div>
          <label className="label">Display Label *</label>
          <input
            className="input w-full text-sm"
            placeholder="e.g. Product SKU"
            value={field.label}
            onChange={e => onUpdate(idx, isMandatory, { label: e.target.value })}
          />
          <p className="text-[10px] text-slate-400 mt-1">Human-readable name shown in the UI and reply emails.</p>
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input w-full text-sm"
            value={field.type}
            onChange={e => onUpdate(idx, isMandatory, { type: e.target.value as TemplateField['type'] })}
          >
            <option value="string">Text — free-form string</option>
            <option value="number">Number — numeric value</option>
            <option value="currency">Currency — dollar amount (e.g. $9.99)</option>
            <option value="date">Date — YYYY-MM-DD format</option>
            <option value="select">Select — one of predefined options</option>
          </select>
        </div>
        <div>
          <label className="label">Example Value</label>
          <input
            className="input w-full text-sm"
            placeholder="e.g. ABC-123"
            value={field.example || ''}
            onChange={e => onUpdate(idx, isMandatory, { example: e.target.value })}
          />
          <p className="text-[10px] text-slate-400 mt-1">Shown to the requester in missing-field reply emails.</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-3">
          <input
            className="input w-full text-sm"
            placeholder="Description — explain what this field represents"
            value={field.description || ''}
            onChange={e => onUpdate(idx, isMandatory, { description: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(idx, isMandatory)}
          className="btn-danger px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove field"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function HelpPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 text-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-blue-700 font-medium"
      >
        <span className="flex items-center gap-2"><Info className="w-4 h-4" /> How templates work</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-blue-800 space-y-3 text-xs leading-relaxed border-t border-blue-200">
          <div>
            <p className="font-semibold mb-1">What is a template?</p>
            <p>A template defines which fields must be present in a pricing-update email. When a request arrives, the system checks each mandatory field against the email body. Missing fields trigger an automatic reply asking the sender to provide them.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Target Email</p>
            <p>The <code className="bg-blue-100 px-1 rounded">To:</code> address of inbound emails must match this exactly (case-insensitive). Use a dedicated alias per template (e.g. <code className="bg-blue-100 px-1 rounded">rates@yourco.com</code>) to route different request types.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Mandatory vs Optional fields</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Mandatory</strong> — the request is put on hold until all these are present. The requester receives a reply listing what's missing.</li>
              <li><strong>Optional</strong> — extracted and stored if present, but never block the request.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">Field detection</p>
            <p>Detection is keyword-based: the <strong>Field Key</strong> (and its label words) are searched in the email text. Use concise, unambiguous keys like <code className="bg-blue-100 px-1 rounded">product_sku</code> or <code className="bg-blue-100 px-1 rounded">new_price</code> to improve accuracy.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Workflow after all fields are present</p>
            <p>Gemini summarises the request → data is mapped to the template → item enters <em>Pending Approval</em>. An approver then accepts or rejects it in the Queue page, which writes the price to the Products table.</p>
          </div>
        </div>
      )}
    </div>
  )
}

const emptyField = (): TemplateField => ({
  key: '', label: '', type: 'string', required: true, description: '', example: '',
})

export default function TemplateFormModal({ template, onClose, onSaved }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Omit<PricingTemplate, '_id'>>({
    name: template?.name || '',
    description: template?.description || '',
    targetEmail: template?.targetEmail || (process.env.NEXT_PUBLIC_PRICING_EMAIL || 'testRates@domain.com'),
    targetCollection: template?.targetCollection || 'products',
    active: template?.active ?? true,
    mandatoryFields: template?.mandatoryFields?.length ? template.mandatoryFields : [emptyField()],
    optionalFields: template?.optionalFields || [],
  })

  const updateField = (idx: number, isMandatory: boolean, changes: Partial<TemplateField>) => {
    const key = isMandatory ? 'mandatoryFields' : 'optionalFields'
    setForm(prev => ({
      ...prev,
      [key]: (prev[key] || []).map((f, i) => i === idx ? { ...f, ...changes } : f),
    }))
  }

  const addField = (isMandatory: boolean) => {
    const key = isMandatory ? 'mandatoryFields' : 'optionalFields'
    setForm(prev => ({ ...prev, [key]: [...(prev[key] || []), { ...emptyField(), required: isMandatory }] }))
  }

  const removeField = (idx: number, isMandatory: boolean) => {
    const key = isMandatory ? 'mandatoryFields' : 'optionalFields'
    setForm(prev => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== idx) }))
  }

  const moveField = (idx: number, isMandatory: boolean) => {
    const fromKey = isMandatory ? 'mandatoryFields' : 'optionalFields'
    const toKey = isMandatory ? 'optionalFields' : 'mandatoryFields'
    setForm(prev => {
      const field = { ...(prev[fromKey] || [])[idx], required: !isMandatory }
      return {
        ...prev,
        [fromKey]: (prev[fromKey] || []).filter((_, i) => i !== idx),
        [toKey]: [...(prev[toKey] || []), field],
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const url = template?._id ? `/api/templates/${template._id}` : '/api/templates'
      const method = template?._id ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (json.success) {
        toast('success', template?._id ? 'Template updated' : 'Template created')
        onSaved()
      } else {
        toast('error', json.error || 'Failed to save')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border flex-shrink-0">
          <h2 className="font-bold text-slate-900 text-lg">{template ? 'Edit Template' : 'New Pricing Template'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Help panel */}
            <HelpPanel />

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Template Name *</label>
                <input
                  required
                  className="input w-full"
                  placeholder="e.g. Product Price Update"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Description *</label>
                <textarea
                  required
                  rows={2}
                  className="input w-full resize-none"
                  placeholder="What is this template for?"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Target Email Address *</label>
                <input
                  required
                  type="email"
                  className="input w-full font-mono text-sm"
                  value={form.targetEmail}
                  onChange={e => setForm(p => ({ ...p, targetEmail: e.target.value.toLowerCase() }))}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Inbound emails must be addressed <em>To:</em> this address exactly. Use a dedicated alias per template.
                </p>
              </div>
              <div className="col-span-2">
                <label className="label">Writes To *</label>
                <select
                  className="input w-full text-sm"
                  value={form.targetCollection}
                  onChange={e => setForm(p => ({ ...p, targetCollection: e.target.value as PricingTemplate['targetCollection'] }))}
                >
                  <option value="products">Products — product SKU pricing table</option>
                  <option value="events">Events — event pricing table</option>
                  <option value="generic">Generic — store in queue only, no collection write</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  On approval, the mapped data is written to this collection.
                </p>
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  checked={form.active}
                  onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                  className="w-4 h-4 rounded accent-brand-500"
                />
                <label htmlFor="active" className="text-sm text-slate-700 cursor-pointer">
                  Active — accept new requests for this template
                </label>
              </div>
            </div>

            {/* Mandatory fields */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-800 text-sm">Mandatory Fields</h3>
                <button type="button" onClick={() => addField(true)}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Requests missing any of these fields will be held and the sender prompted to supply them.
              </p>
              <div className="space-y-3">
                {form.mandatoryFields.map((f, i) => (
                  <FieldRow key={i} field={f} idx={i} isMandatory={true} onUpdate={updateField} onRemove={removeField} onMove={moveField} />
                ))}
              </div>
            </div>

            {/* Optional fields */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-800 text-sm">Optional Fields</h3>
                <button type="button" onClick={() => addField(false)}
                  className="text-xs text-slate-600 hover:text-slate-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Extracted and stored if present in the email, but will never block a request.
              </p>
              <div className="space-y-3">
                {(form.optionalFields || []).map((f, i) => (
                  <FieldRow key={i} field={f} idx={i} isMandatory={false} onUpdate={updateField} onRemove={removeField} onMove={moveField} />
                ))}
                {!form.optionalFields?.length && (
                  <p className="text-xs text-slate-600 italic">No optional fields defined</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t border-surface-border bg-surface-card">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary text-sm min-w-24">
              {loading ? 'Saving...' : template ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
