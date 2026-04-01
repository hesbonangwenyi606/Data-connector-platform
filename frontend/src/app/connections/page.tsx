'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle,
  Database,
  Edit2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import Layout from '@/components/Layout'
import Modal from '@/components/Modal'
import ConnectionForm from '@/components/ConnectionForm'
import { InlineSpinner } from '@/components/Spinner'
import Spinner from '@/components/Spinner'
import { connectorsAPI } from '@/lib/api'
import { cn, extractErrorMessage, formatDate, getDbTypeLabel } from '@/lib/utils'
import type { DatabaseConnection, DatabaseConnectionCreate } from '@/types'

type TestState = 'idle' | 'testing' | 'success' | 'error'
type TestResult = { state: TestState; message?: string }

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<DatabaseConnection | null>(null)

  // Test states per connection
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({})

  // Success toast
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 3500)
  }

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await connectorsAPI.list()
      setConnections(data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleOpenCreate = () => {
    setEditingConnection(null)
    setFormError(null)
    setShowModal(true)
  }

  const handleOpenEdit = (conn: DatabaseConnection) => {
    setEditingConnection(conn)
    setFormError(null)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingConnection(null)
    setFormError(null)
  }

  const handleSubmit = async (data: DatabaseConnectionCreate) => {
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (editingConnection) {
        const updated = await connectorsAPI.update(editingConnection.id, data)
        setConnections((prev) =>
          prev.map((c) => (c.id === editingConnection.id ? updated : c))
        )
        handleCloseModal()
        showSuccess('Connection updated successfully.')
      } else {
        const created = await connectorsAPI.create(data)
        setConnections((prev) => [created, ...prev])
        handleCloseModal()
        showSuccess('Connection created successfully.')
      }
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTest = async (conn: DatabaseConnection) => {
    setTestResults((prev) => ({ ...prev, [conn.id]: { state: 'testing' } }))
    try {
      const result = await connectorsAPI.test(conn.id)
      setTestResults((prev) => ({
        ...prev,
        [conn.id]: {
          state: result.success ? 'success' : 'error',
          message: result.message,
        },
      }))
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [conn.id]: {
          state: 'error',
          message: extractErrorMessage(err),
        },
      }))
    }
  }

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return
    setDeletingId(showDeleteConfirm.id)
    try {
      await connectorsAPI.delete(showDeleteConfirm.id)
      setConnections((prev) => prev.filter((c) => c.id !== showDeleteConfirm.id))
      setShowDeleteConfirm(null)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  const DB_TYPE_COLORS: Record<string, string> = {
    postgresql: 'badge-blue',
    mysql: 'badge-green',
    mongodb: 'badge-yellow',
    clickhouse: 'badge-gray',
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Connections</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your database connections
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchConnections}
              className="btn-secondary"
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={handleOpenCreate} className="btn-primary">
              <Plus size={15} />
              Add Connection
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="flex items-center gap-2 p-4 bg-blue-600 text-white text-sm font-medium rounded-lg mb-4 shadow-md animate-fade-in">
            <CheckCircle size={16} className="flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <InlineSpinner text="Loading connections..." />
        ) : connections.length === 0 ? (
          <div className="card p-16 text-center">
            <Database size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">
              No connections yet
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Add your first database connection to start extracting data.
            </p>
            <button onClick={handleOpenCreate} className="btn-primary">
              <Plus size={15} />
              Add Connection
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Host</th>
                  <th className="table-header">Database</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((conn) => {
                  const testResult = testResults[conn.id]
                  return (
                    <tr
                      key={conn.id}
                      className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="table-cell font-medium text-slate-800">
                        {conn.name}
                      </td>
                      <td className="table-cell">
                        <span className={cn('badge', DB_TYPE_COLORS[conn.db_type] || 'badge-gray')}>
                          {getDbTypeLabel(conn.db_type)}
                        </span>
                      </td>
                      <td className="table-cell text-slate-500">
                        {conn.host}:{conn.port}
                      </td>
                      <td className="table-cell text-slate-500">{conn.database}</td>
                      <td className="table-cell">
                        <span
                          className={cn(
                            'badge',
                            conn.is_active ? 'badge-green' : 'badge-gray'
                          )}
                        >
                          {conn.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-cell text-slate-400 text-xs">
                        {formatDate(conn.created_at)}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-2">
                          {/* Test result indicator */}
                          {testResult && testResult.state !== 'idle' && (
                            <span
                              className={cn(
                                'text-xs font-medium flex items-center gap-1',
                                testResult.state === 'success'
                                  ? 'text-emerald-600'
                                  : testResult.state === 'error'
                                  ? 'text-red-600'
                                  : 'text-slate-400'
                              )}
                              title={testResult.message}
                            >
                              {testResult.state === 'testing' ? (
                                <Spinner size="sm" />
                              ) : testResult.state === 'success' ? (
                                <CheckCircle size={14} />
                              ) : (
                                <XCircle size={14} />
                              )}
                              {testResult.state === 'success'
                                ? 'OK'
                                : testResult.state === 'error'
                                ? 'Failed'
                                : ''}
                            </span>
                          )}

                          <button
                            onClick={() => handleTest(conn)}
                            disabled={testResult?.state === 'testing'}
                            className="btn-secondary text-xs px-2.5 py-1.5"
                            title="Test connection"
                          >
                            {testResult?.state === 'testing' ? (
                              <Spinner size="sm" />
                            ) : (
                              <RefreshCw size={13} />
                            )}
                            Test
                          </button>
                          <button
                            onClick={() => handleOpenEdit(conn)}
                            className="btn-secondary text-xs px-2.5 py-1.5"
                            title="Edit connection"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(conn)}
                            className="btn-danger text-xs px-2.5 py-1.5"
                            title="Delete connection"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingConnection ? 'Edit Connection' : 'Add Connection'}
        size="lg"
      >
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
            {formError}
          </div>
        )}
        <ConnectionForm
          initialData={editingConnection}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Connection"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="btn-secondary"
              disabled={!!deletingId}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="btn-danger"
              disabled={!!deletingId}
            >
              {deletingId ? <Spinner size="sm" /> : <Trash2 size={14} />}
              Delete
            </button>
          </>
        }
      >
        <p className="text-slate-600 text-sm">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-800">
            {showDeleteConfirm?.name}
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>
    </Layout>
  )
}
