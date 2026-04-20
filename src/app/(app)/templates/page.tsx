'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, Mail, CheckCircle, XCircle } from 'lucide-react'
import { PricingTemplate } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import TemplateFormModal from './TemplateFormModal'

export default function TemplatesPage() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<PricingTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PricingTemplate | null>(null)

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/templates')
      const json = await res.json()
      if (json.success) setTemplates(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      toast('success', 'Template deleted')
      fetchTemplates()
    } else {
      toast('error', json.error || 'Failed to delete')
    }
  }

  const openNew = () => { setEditing(null); setShowModal(true) }
  const openEdit = (t: PricingTemplate) => { setEditing(t); setShowModal(true) }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing Templates</h1>
          <p className="text-slate-500 text-sm mt-1">Define mandatory fields for pricing update requests</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchTemplates} disabled={loading} className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={openNew} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading templates...</div>
      ) : !templates.length ? (
        <div className="card p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6 text-brand-400" />
          </div>
          <h3 className="font-semibold text-slate-800 mb-2">No templates yet</h3>
          <p className="text-slate-500 text-sm mb-6">Create your first pricing template to start receiving structured requests.</p>
          <button onClick={openNew} className="btn-primary text-sm inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map(t => (
            <div key={t._id} className="card p-5 hover:border-slate-300 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-slate-900">{t.name}</h3>
                    {t.active
                      ? <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-300"><CheckCircle className="w-3 h-3" />Active</span>
                      : <span className="badge bg-slate-200 text-slate-600 border border-slate-300"><XCircle className="w-3 h-3" />Inactive</span>
                    }
                  </div>
                  <p className="text-slate-600 text-sm mb-3">{t.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> {t.targetEmail}
                    </span>
                    <span>{t.mandatoryFields.length} mandatory fields</span>
                    {t.optionalFields?.length ? <span>{t.optionalFields.length} optional fields</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {t.mandatoryFields.slice(0, 6).map(f => (
                      <span key={f.key} className="badge bg-slate-100 text-slate-600 border border-slate-300 text-[10px]">
                        {f.label}
                      </span>
                    ))}
                    {t.mandatoryFields.length > 6 && (
                      <span className="badge bg-slate-100 text-slate-500 border border-slate-300 text-[10px]">
                        +{t.mandatoryFields.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(t)} className="btn-secondary text-sm flex items-center gap-1.5 px-3 py-1.5">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => handleDelete(t._id!)} className="btn-danger text-sm flex items-center gap-1.5 px-3 py-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TemplateFormModal
          template={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchTemplates() }}
        />
      )}
    </div>
  )
}
