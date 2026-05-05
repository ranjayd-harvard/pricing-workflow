'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Upload,
  ImageIcon,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  RotateCcw,
  FileImage,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'upload' | 'review' | 'done'
type FileKind = 'image' | 'spreadsheet'

interface ExtractResult {
  extractedText: string
  filename: string
  fileSize: number
  mimeType: string
  sheetNames?: string[]
}

interface SubmitResult {
  queueId: string
  status: string
  message: string
}

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
])
const SPREADSHEET_TYPES = new Set([
  'text/csv', 'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
])
const SPREADSHEET_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls'])

function fileExtension(name: string) {
  return (name.toLowerCase().match(/\.[^.]+$/) || [''])[0]
}

function detectKind(file: File): FileKind | null {
  if (IMAGE_TYPES.has(file.type)) return 'image'
  if (SPREADSHEET_TYPES.has(file.type) || SPREADSHEET_EXTENSIONS.has(fileExtension(file.name))) return 'spreadsheet'
  return null
}

export default function UploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [fileKind, setFileKind] = useState<FileKind | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [senderEmail, setSenderEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [subject, setSubject] = useState('Pricing Update Request')

  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null)
  const [editedText, setEditedText] = useState('')

  const [extracting, setExtracting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((selected: File) => {
    const kind = detectKind(selected)
    if (!kind) {
      setError(`Unsupported file type. Please upload an image (JPG, PNG, WebP, GIF, BMP, TIFF) or spreadsheet (CSV, XLSX, XLS).`)
      return
    }
    const limit = kind === 'image' ? 8 : 10
    if (selected.size > limit * 1024 * 1024) {
      setError(`File exceeds the ${limit} MB limit.`)
      return
    }
    setError(null)
    setFile(selected)
    setFileKind(kind)
    setPreviewUrl(kind === 'image' ? URL.createObjectURL(selected) : null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelect(dropped)
  }, [handleFileSelect])

  const handleExtract = async () => {
    if (!file || !senderEmail.trim() || !fileKind) return
    setExtracting(true)
    setError(null)
    try {
      const form = new FormData()
      const subjectVal = subject.trim() || 'Pricing Update Request'

      let url: string
      if (fileKind === 'image') {
        form.append('image', file)
        url = '/api/emails/extract-image'
      } else {
        form.append('file', file)
        url = '/api/emails/extract-spreadsheet'
      }
      form.append('senderEmail', senderEmail.trim())
      form.append('senderName', senderName.trim())
      form.append('subject', subjectVal)

      const res = await fetch(url, { method: 'POST', body: form })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Extraction failed')

      setExtractResult(json.data)
      setEditedText(json.data.extractedText)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setExtracting(false)
    }
  }

  const handleSubmit = async () => {
    if (!editedText.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const from = senderName.trim() ? `${senderName.trim()} <${senderEmail.trim()}>` : senderEmail.trim()
      const res = await fetch('/api/emails/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, subject: subject.trim() || 'Pricing Update Request', body: editedText }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Submission failed')
      setSubmitResult({ queueId: json.data?.queueId || '', status: json.data?.status || '', message: json.message || 'Submitted successfully' })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setStep('upload'); setFile(null); setFileKind(null); setPreviewUrl(null)
    setSenderEmail(''); setSenderName(''); setSubject('Pricing Update Request')
    setExtractResult(null); setEditedText(''); setError(null); setSubmitResult(null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Pricing File</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload an image or spreadsheet with pricing data — Gemini will extract the data and submit it to the queue.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {(['upload', 'review', 'done'] as Step[]).map((s, i) => {
          const labels = ['Upload & Configure', 'Review Extraction', 'Done']
          const idx = ['upload', 'review', 'done'].indexOf(step)
          const isCurrent = s === step
          const isDone = i < idx
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={cn('h-px w-8', isDone || isCurrent ? 'bg-brand-400' : 'bg-slate-200')} />}
              <div className={cn('flex items-center gap-2 text-sm font-medium', isCurrent ? 'text-brand-700' : isDone ? 'text-emerald-600' : 'text-slate-400')}>
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', isCurrent ? 'bg-brand-600 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500')}>
                  {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="hidden sm:block">{labels[i]}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── STEP 1 ───────────────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Drop zone */}
          <div
            className={cn(
              'card border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-10 gap-4 cursor-pointer transition-colors',
              isDragging ? 'border-brand-400 bg-brand-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-brand-300 hover:bg-surface-hover',
            )}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={[...IMAGE_TYPES, ...SPREADSHEET_TYPES, '.csv', '.xlsx', '.xls'].join(',')}
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />
            {file ? (
              <>
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  {fileKind === 'image'
                    ? previewUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={previewUrl} alt="preview" className="w-14 h-14 rounded-full object-cover" />
                      : <ImageIcon className="w-7 h-7 text-emerald-600" />
                    : <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
                  }
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Drag & drop or click to upload</p>
                  <p className="text-xs text-slate-400 mt-1">Images: JPG, PNG, WebP, GIF, BMP, TIFF · Max 8 MB</p>
                  <p className="text-xs text-slate-400">Spreadsheets: CSV, XLSX, XLS · Max 10 MB</p>
                </div>
              </>
            )}
          </div>

          {/* Form */}
          <div className="card p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Sender Email <span className="text-red-500">*</span>
              </label>
              <input type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)}
                placeholder="supplier@example.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Sender Name <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 bg-white" />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
              </div>
            )}

            <button onClick={handleExtract} disabled={!file || !senderEmail.trim() || extracting}
              className={cn('w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all',
                file && senderEmail.trim() && !extracting ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
              {extracting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Extracting with Gemini...</>
              ) : fileKind === 'spreadsheet' ? (
                <><FileSpreadsheet className="w-4 h-4" />Extract Data from Spreadsheet</>
              ) : (
                <><ImageIcon className="w-4 h-4" />Extract Text from Image</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ───────────────────────────────────────────────────────────── */}
      {step === 'review' && extractResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* File info panel */}
            <div className="lg:col-span-2 card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {fileKind === 'image' ? <FileImage className="w-3.5 h-3.5" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                {fileKind === 'image' ? 'Source Image' : 'Source Spreadsheet'}
              </div>
              {fileKind === 'image' && previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Uploaded" className="w-full object-contain rounded-lg max-h-72" />
              )}
              {fileKind === 'spreadsheet' && (
                <div className="flex items-center justify-center h-32 bg-emerald-50 rounded-lg border border-emerald-100">
                  <FileSpreadsheet className="w-12 h-12 text-emerald-400" />
                </div>
              )}
              <div className="text-xs text-slate-500 space-y-0.5">
                <p className="font-medium text-slate-700 truncate">{extractResult.filename}</p>
                <p>{(extractResult.fileSize / 1024).toFixed(1)} KB · {extractResult.mimeType}</p>
                {extractResult.sheetNames && extractResult.sheetNames.length > 0 && (
                  <p className="text-slate-400">Sheets: {extractResult.sheetNames.join(', ')}</p>
                )}
                <p className="pt-1 text-slate-400">
                  <span className="font-medium text-slate-600">From:</span>{' '}
                  {senderName ? `${senderName} <${senderEmail}>` : senderEmail}
                </p>
                <p className="text-slate-400"><span className="font-medium text-slate-600">Subject:</span> {subject}</p>
              </div>
            </div>

            {/* Extracted text */}
            <div className="lg:col-span-3 card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                Extracted Text
                <span className="text-slate-400 font-normal normal-case">— edit if needed before submitting</span>
              </div>
              <textarea value={editedText} onChange={e => setEditedText(e.target.value)} rows={16}
                className="w-full flex-1 px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 bg-slate-50 resize-none leading-relaxed" />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSubmit} disabled={!editedText.trim() || submitting}
              className={cn('flex items-center gap-2 py-2.5 px-6 rounded-lg text-sm font-semibold transition-all',
                editedText.trim() && !submitting ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting to queue...</> : <><Send className="w-4 h-4" />Submit to Queue</>}
            </button>
            <button onClick={() => setStep('upload')}
              className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-surface-hover transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />Back
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 ───────────────────────────────────────────────────────────── */}
      {step === 'done' && submitResult && (
        <div className="card p-10 flex flex-col items-center gap-6 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Submitted Successfully</h2>
            <p className="text-slate-500 text-sm mt-2">{submitResult.message}</p>
            {submitResult.status && (
              <p className="text-xs text-slate-400 mt-1">Status: <span className="font-medium text-slate-600">{submitResult.status.replace(/_/g, ' ')}</span></p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {submitResult.queueId && (
              <Link href={`/queue/${submitResult.queueId}`}
                className="flex items-center gap-2 py-2.5 px-5 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-colors">
                View in Queue<ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <button onClick={reset}
              className="flex items-center gap-2 py-2.5 px-5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-surface-hover transition-colors btn-secondary">
              <RotateCcw className="w-3.5 h-3.5" />Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
