'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Shield, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface UserRow {
  _id: string
  name: string
  email: string
  provider: string
  role: 'admin' | 'viewer'
  createdAt: string
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (session?.user.role !== 'admin') { router.replace('/dashboard'); return }
    fetchUsers()
  }, [session, status])

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const json = await res.json()
    if (json.success) setUsers(json.data)
    setLoading(false)
  }

  async function toggleRole(userId: string, currentRole: 'admin' | 'viewer') {
    const newRole = currentRole === 'admin' ? 'viewer' : 'admin'
    setUpdating(userId)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    const json = await res.json()
    if (json.success) {
      toast('success', json.message)
      setUsers(u => u.map(x => x._id === userId ? { ...x, role: newRole } : x))
    } else {
      toast('error', json.error)
    }
    setUpdating(null)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-6 h-6 text-brand-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500">Manage roles for all registered users</p>
        </div>
      </div>

      <div className="card divide-y divide-surface-border">
        {users.map(user => (
          <div key={user._id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <span className="text-brand-700 font-semibold text-xs">{user.name?.[0]?.toUpperCase() ?? '?'}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {user.name}
                  {user._id === session?.user.id && (
                    <span className="ml-2 text-xs text-slate-400">(you)</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{user.email} · via {user.provider}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                user.role === 'admin'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {user.role}
              </span>
              <button
                disabled={updating === user._id || user._id === session?.user.id}
                onClick={() => toggleRole(user._id, user.role)}
                className="text-xs btn-secondary disabled:opacity-40"
              >
                {updating === user._id
                  ? 'Saving…'
                  : user.role === 'admin' ? 'Make viewer' : 'Make admin'}
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No users found.</p>
        )}
      </div>
    </div>
  )
}
