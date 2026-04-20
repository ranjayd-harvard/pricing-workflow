'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { RefreshCw, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PriceHistory {
  old_price: number
  new_price: number
  changed_at: string
  queue_id: string
}

interface Product {
  _id: string
  product_sku: string
  product_name: string
  current_price: number
  new_price: number
  effective_date: string
  reason: string
  region?: string
  currency?: string
  notes?: string
  last_updated_by: string
  last_queue_id: string
  price_history: PriceHistory[]
  createdAt: string
  updatedAt: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSku, setExpandedSku] = useState<string | null>(null)

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/products')
      const json = await res.json()
      if (json.success) setProducts(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500 text-sm mt-1">Current pricing table — updated on approval</p>
        </div>
        <button onClick={fetchProducts} disabled={loading}
          className="flex items-center gap-2 btn-secondary text-sm">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-slate-500 text-sm">Loading...</div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 text-sm">
          <Package className="w-8 h-8 mx-auto mb-3 opacity-30" />
          No products yet. Approve a pricing request to populate this table.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left p-4">SKU</th>
                <th className="text-left p-4">Product Name</th>
                <th className="text-right p-4">Current Price</th>
                <th className="text-left p-4">Effective Date</th>
                <th className="text-left p-4">Region</th>
                <th className="text-left p-4">Currency</th>
                <th className="text-left p-4">Last Updated By</th>
                <th className="text-left p-4">Updated At</th>
                <th className="text-left p-4">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {products.map(product => (
                <>
                  <tr key={product._id} className="hover:bg-surface-hover transition-colors">
                    <td className="p-4 font-mono text-brand-400 font-medium">{product.product_sku}</td>
                    <td className="p-4 text-slate-800">{product.product_name}</td>
                    <td className="p-4 text-right text-emerald-700 font-semibold">
                      {product.currency || 'USD'} {Number(product.current_price).toFixed(2)}
                    </td>
                    <td className="p-4 text-slate-700">{product.effective_date}</td>
                    <td className="p-4 text-slate-600">{product.region || '—'}</td>
                    <td className="p-4 text-slate-600">{product.currency || 'USD'}</td>
                    <td className="p-4 text-slate-600 text-xs">{product.last_updated_by}</td>
                    <td className="p-4 text-slate-500 text-xs">
                      {format(new Date(product.updatedAt), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="p-4">
                      {product.price_history.length > 0 && (
                        <button
                          onClick={() => setExpandedSku(expandedSku === product.product_sku ? null : product.product_sku)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          {product.price_history.length} entries
                          {expandedSku === product.product_sku
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedSku === product.product_sku && product.price_history.length > 0 && (
                    <tr key={`${product._id}-history`}>
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
                              {[...product.price_history].reverse().map((h, i) => (
                                <tr key={i}>
                                  <td className="p-3 text-slate-600">{format(new Date(h.changed_at), 'MMM d, yyyy HH:mm')}</td>
                                  <td className="p-3 text-right text-red-600">{Number(h.old_price).toFixed(2)}</td>
                                  <td className="p-3 text-right text-emerald-700">{Number(h.new_price).toFixed(2)}</td>
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
