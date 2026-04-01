'use client'

import { useEffect, useState } from 'react'
import { Database, FileText, Table2, TrendingUp } from 'lucide-react'
import Layout from '@/components/Layout'
import { InlineSpinner } from '@/components/Spinner'
import { connectorsAPI, extractionsAPI, storageAPI } from '@/lib/api'
import { formatDate, formatBytes, getStatusBadgeClass, cn } from '@/lib/utils'
import type { DatabaseConnection, ExtractionBatch, StoredFile } from '@/types'

interface DashboardStats {
  totalConnections: number
  activeConnections: number
  totalExtractions: number
  totalFiles: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentExtractions, setRecentExtractions] = useState<ExtractionBatch[]>([])
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [files, setFiles] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [connectorsData, extractionsData, storageData] = await Promise.all([
          connectorsAPI.list(),
          extractionsAPI.list(),
          storageAPI.list(),
        ])

        setConnections(connectorsData)
        setRecentExtractions(extractionsData.slice(0, 10))
        setFiles(storageData)

        setStats({
          totalConnections: connectorsData.length,
          activeConnections: connectorsData.filter((c) => c.is_active).length,
          totalExtractions: extractionsData.length,
          totalFiles: storageData.length,
        })
      } catch {
        setError('Failed to load dashboard data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Overview of your data connector platform
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <InlineSpinner text="Loading dashboard..." />
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <StatCard
                title="Total Connections"
                value={stats?.totalConnections ?? 0}
                subtitle={`${stats?.activeConnections ?? 0} active`}
                icon={<Database size={22} className="text-blue-600" />}
                color="blue"
              />
              <StatCard
                title="Total Extractions"
                value={stats?.totalExtractions ?? 0}
                subtitle="All time"
                icon={<Table2 size={22} className="text-purple-600" />}
                color="purple"
              />
              <StatCard
                title="Stored Files"
                value={stats?.totalFiles ?? 0}
                subtitle={
                  files.length > 0
                    ? `${formatBytes(files.reduce((acc, f) => acc + (f.file_size || 0), 0))} total`
                    : '0 B total'
                }
                icon={<FileText size={22} className="text-emerald-600" />}
                color="emerald"
              />
              <StatCard
                title="Recent Activity"
                value={recentExtractions.filter((e) => e.status === 'completed').length}
                subtitle="Completed extractions"
                icon={<TrendingUp size={22} className="text-amber-600" />}
                color="amber"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Extractions */}
              <div className="lg:col-span-2 card">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-slate-800">
                    Recent Extractions
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  {recentExtractions.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      No extractions yet. Go to Extract to get started.
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">Table</th>
                          <th className="table-header">Connection</th>
                          <th className="table-header">Rows</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentExtractions.map((extraction) => (
                          <tr
                            key={extraction.id}
                            className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                          >
                            <td className="table-cell font-medium">
                              {extraction.table_name}
                            </td>
                            <td className="table-cell text-slate-500">
                              {extraction.connection_name ||
                                connections.find((c) => c.id === extraction.connection)
                                  ?.name ||
                                `#${extraction.connection}`}
                            </td>
                            <td className="table-cell">{extraction.row_count}</td>
                            <td className="table-cell">
                              <span
                                className={cn(
                                  'badge',
                                  getStatusBadgeClass(extraction.status)
                                )}
                              >
                                {extraction.status}
                              </span>
                            </td>
                            <td className="table-cell text-slate-500 text-xs">
                              {formatDate(extraction.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Quick connections overview */}
              <div className="card">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-slate-800">
                    Connections
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {connections.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 text-sm">
                      No connections yet.
                    </p>
                  ) : (
                    connections.slice(0, 6).map((conn) => (
                      <div
                        key={conn.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                      >
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            conn.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {conn.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {conn.db_type} · {conn.host}:{conn.port}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string
  value: number
  subtitle: string
  icon: React.ReactNode
  color: 'blue' | 'purple' | 'emerald' | 'amber'
}) {
  const bgMap = {
    blue: 'bg-blue-50',
    purple: 'bg-purple-50',
    emerald: 'bg-emerald-50',
    amber: 'bg-amber-50',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bgMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  )
}
