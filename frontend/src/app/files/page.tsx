'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Download,
  FileText,
  RefreshCw,
  Share2,
  Trash2,
} from 'lucide-react'
import Layout from '@/components/Layout'
import Modal from '@/components/Modal'
import Spinner, { InlineSpinner } from '@/components/Spinner'
import { storageAPI } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn, extractErrorMessage, formatBytes, formatDate } from '@/lib/utils'
import type { StoredFile } from '@/types'

export default function FilesPage() {
  const { user } = useAuth()
  const [files, setFiles] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Download state
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  // Share modal
  const [shareFile, setShareFile] = useState<StoredFile | null>(null)
  const [shareUsername, setShareUsername] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState<string | null>(null)

  // Delete modal
  const [deleteFile, setDeleteFile] = useState<StoredFile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await storageAPI.list()
      setFiles(data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleDownload = async (file: StoredFile) => {
    setDownloadingId(file.id)
    try {
      const blob = await storageAPI.download(file.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch_${file.batch}.${file.file_format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setDownloadingId(null)
    }
  }

  const handleShare = async () => {
    if (!shareFile || !shareUsername.trim()) return
    setSharing(true)
    setShareError(null)
    setShareSuccess(null)
    try {
      await storageAPI.share(shareFile.id, shareUsername.trim())
      setShareSuccess(`File shared with "${shareUsername.trim()}" successfully.`)
      setShareUsername('')
      fetchFiles()
    } catch (err) {
      setShareError(extractErrorMessage(err))
    } finally {
      setSharing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteFile) return
    setDeleting(true)
    try {
      await storageAPI.delete(deleteFile.id)
      setFiles((prev) => prev.filter((f) => f.id !== deleteFile.id))
      setDeleteFile(null)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const canManageFile = (file: StoredFile) => {
    return user?.role === 'admin' || file.created_by === user?.id
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '—'
    return formatBytes(bytes)
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Files</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage and download your extracted data files
            </p>
          </div>
          <button
            onClick={fetchFiles}
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
          <InlineSpinner text="Loading files..." />
        ) : files.length === 0 ? (
          <div className="card p-16 text-center">
            <FileText size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No files yet</h3>
            <p className="text-slate-400 text-sm">
              Files will appear here after you submit an extraction.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">File</th>
                  <th className="table-header">Batch</th>
                  <th className="table-header">Format</th>
                  <th className="table-header">Size</th>
                  <th className="table-header">Shared With</th>
                  <th className="table-header">Created</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.id}
                    className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-800 truncate max-w-[180px]">
                          {file.file_path
                            ? file.file_path.split('/').pop() || `file_${file.id}`
                            : `batch_${file.batch}.${file.file_format}`}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell text-slate-500">#{file.batch}</td>
                    <td className="table-cell">
                      <span
                        className={cn(
                          'badge uppercase',
                          file.file_format === 'json' ? 'badge-blue' : 'badge-green'
                        )}
                      >
                        {file.file_format}
                      </span>
                    </td>
                    <td className="table-cell text-slate-500">
                      {formatFileSize(file.file_size)}
                    </td>
                    <td className="table-cell text-slate-500">
                      {file.shared_with && file.shared_with.length > 0 ? (
                        <span className="badge badge-gray">
                          {file.shared_with.length} user
                          {file.shared_with.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">None</span>
                      )}
                    </td>
                    <td className="table-cell text-slate-400 text-xs">
                      {formatDate(file.created_at)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloadingId === file.id}
                          className="btn-secondary text-xs px-2.5 py-1.5"
                          title="Download file"
                        >
                          {downloadingId === file.id ? (
                            <Spinner size="sm" />
                          ) : (
                            <Download size={13} />
                          )}
                          Download
                        </button>

                        {canManageFile(file) && (
                          <>
                            <button
                              onClick={() => {
                                setShareFile(file)
                                setShareUsername('')
                                setShareError(null)
                                setShareSuccess(null)
                              }}
                              className="btn-secondary text-xs px-2.5 py-1.5"
                              title="Share file"
                            >
                              <Share2 size={13} />
                              Share
                            </button>
                            <button
                              onClick={() => setDeleteFile(file)}
                              className="btn-danger text-xs px-2.5 py-1.5"
                              title="Delete file"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={!!shareFile}
        onClose={() => setShareFile(null)}
        title="Share File"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShareFile(null)}
              className="btn-secondary"
              disabled={sharing}
            >
              Close
            </button>
            <button
              onClick={handleShare}
              disabled={sharing || !shareUsername.trim()}
              className="btn-primary"
            >
              {sharing ? (
                <>
                  <Spinner size="sm" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 size={14} />
                  Share
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Share this file with another user by entering their username below.
          </p>
          {shareError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {shareError}
            </div>
          )}
          {shareSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              {shareSuccess}
            </div>
          )}
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              value={shareUsername}
              onChange={(e) => setShareUsername(e.target.value)}
              className="input-field"
              placeholder="Enter username..."
              onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteFile}
        onClose={() => setDeleteFile(null)}
        title="Delete File"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteFile(null)}
              className="btn-secondary"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="btn-danger"
              disabled={deleting}
            >
              {deleting ? <Spinner size="sm" /> : <Trash2 size={14} />}
              Delete
            </button>
          </>
        }
      >
        <p className="text-slate-600 text-sm">
          Are you sure you want to permanently delete this file? This cannot be
          undone.
        </p>
      </Modal>
    </Layout>
  )
}
