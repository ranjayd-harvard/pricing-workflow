import { cn } from '@/lib/utils'
import { QueueStatus } from '@/types'

const statusConfig: Record<QueueStatus, { label: string; classes: string; dot: string }> = {
  pending_clarification: { label: 'Needs Clarification', classes: 'bg-violet-50 text-violet-700 border-violet-300', dot: 'bg-violet-500 animate-pulse' },
  pending_info: { label: 'Pending Info', classes: 'bg-amber-50 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  pending_summary: { label: 'Processing', classes: 'bg-blue-50 text-blue-700 border-blue-300', dot: 'bg-blue-500 animate-pulse' },
  summarized: { label: 'Summarized', classes: 'bg-cyan-50 text-cyan-700 border-cyan-300', dot: 'bg-cyan-500' },
  mapped: { label: 'Mapped', classes: 'bg-purple-50 text-purple-700 border-purple-300', dot: 'bg-purple-500' },
  pending_approval: { label: 'Needs Approval', classes: 'bg-orange-50 text-orange-700 border-orange-300', dot: 'bg-orange-500 animate-pulse' },
  approved: { label: 'Approved', classes: 'bg-emerald-50 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', classes: 'bg-red-50 text-red-700 border-red-300', dot: 'bg-red-500' },
  price_updated: { label: 'Price Updated', classes: 'bg-green-50 text-green-700 border-green-300', dot: 'bg-green-500' },
  failed: { label: 'Failed', classes: 'bg-red-50 text-red-700 border-red-300', dot: 'bg-red-600' },
}

interface StatusBadgeProps {
  status: QueueStatus
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, classes: 'bg-slate-100 text-slate-600 border-slate-300', dot: 'bg-slate-500' }
  return (
    <span className={cn('badge border', config.classes, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}
