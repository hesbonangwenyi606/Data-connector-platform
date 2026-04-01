'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Shield, User as UserIcon } from 'lucide-react'
import Layout from '@/components/Layout'
import { InlineSpinner } from '@/components/Spinner'
import { usersAPI } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn, extractErrorMessage, formatDate } from '@/lib/utils'
import type { User } from '@/types'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await usersAPI.list()
      setUsers(data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  if (currentUser?.role !== 'admin') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-16 text-center">
          <Shield size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm">
            You do not have permission to view this page. Admin access is required.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Users</h1>
            <p className="text-slate-500 text-sm mt-1">
              All registered users on the platform
            </p>
          </div>
          <button
            onClick={fetchUsers}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <InlineSpinner text="Loading users..." />
        ) : users.length === 0 ? (
          <div className="card p-16 text-center">
            <UserIcon size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">No users found.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {users.length} user{users.length !== 1 ? 's' : ''}
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">User</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      'border-t border-slate-100 hover:bg-slate-50 transition-colors',
                      u.id === currentUser?.id && 'bg-blue-50/40'
                    )}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-slate-600 uppercase">
                            {u.username[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">
                            {u.username}
                            {u.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-blue-500 font-normal">(you)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-slate-500 text-sm">
                      {u.email || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-cell">
                      <span
                        className={cn(
                          'badge',
                          u.role === 'admin' ? 'badge-purple' : 'badge-gray'
                        )}
                      >
                        {u.role === 'admin' ? (
                          <Shield size={11} className="inline mr-1" />
                        ) : (
                          <UserIcon size={11} className="inline mr-1" />
                        )}
                        {u.role}
                      </span>
                    </td>
                    <td className="table-cell text-slate-400 text-xs">
                      {formatDate(u.date_joined)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
