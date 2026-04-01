'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  Play,
  Send,
} from 'lucide-react'
import Layout from '@/components/Layout'
import DataGrid from '@/components/DataGrid'
import Spinner, { InlineSpinner } from '@/components/Spinner'
import { connectorsAPI, extractionsAPI } from '@/lib/api'
import { cn, extractErrorMessage, formatBytes } from '@/lib/utils'
import type { DatabaseConnection, DataRecord, ExtractionBatch, StoredFile } from '@/types'

type Step = 'configure' | 'edit' | 'done'

export default function ExtractPage() {
  const [step, setStep] = useState<Step>('configure')

  // Step 1 state
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<number | ''>('')
  const [tables, setTables] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState('')
  const [batchSize, setBatchSize] = useState(100)
  const [offset, setOffset] = useState(0)
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [step1Error, setStep1Error] = useState<string | null>(null)

  // Step 2 state
  const [batch, setBatch] = useState<ExtractionBatch | null>(null)
  const [records, setRecords] = useState<DataRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Step 3 state
  const [submittedFile, setSubmittedFile] = useState<StoredFile | null>(null)

  // Load connections on mount
  useEffect(() => {
    const load = async () => {
      setLoadingConnections(true)
      try {
        const data = await connectorsAPI.list()
        setConnections(data.filter((c) => c.is_active))
      } catch (err) {
        setStep1Error(extractErrorMessage(err))
      } finally {
        setLoadingConnections(false)
      }
    }
    load()
  }, [])

  // Load tables when connection changes
  useEffect(() => {
    if (!selectedConnection) {
      setTables([])
      setSelectedTable('')
      return
    }
    const loadTables = async () => {
      setLoadingTables(true)
      setStep1Error(null)
      setTables([])
      setSelectedTable('')
      try {
        const data = await connectorsAPI.getTables(Number(selectedConnection))
        setTables(data)
      } catch (err) {
        setStep1Error(extractErrorMessage(err))
      } finally {
        setLoadingTables(false)
      }
    }
    loadTables()
  }, [selectedConnection])

  const handleExtract = async () => {
    if (!selectedConnection || !selectedTable) return
    setExtracting(true)
    setStep1Error(null)
    try {
      const newBatch = await extractionsAPI.create({
        connection: Number(selectedConnection),
        table_name: selectedTable,
        batch_size: batchSize,
        offset: offset,
      })
      setBatch(newBatch)

      // Load records
      setLoadingRecords(true)
      setStep('edit')
      const recs = await extractionsAPI.getRecords(newBatch.id)
      setRecords(recs)
    } catch (err) {
      setStep1Error(extractErrorMessage(err))
    } finally {
      setExtracting(false)
      setLoadingRecords(false)
    }
  }

  const handleDataChange = useCallback((updatedRows: DataRecord[]) => {
    setRecords(updatedRows)
  }, [])

  const handleSubmit = async () => {
    if (!batch) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const modifiedRecords = records
        .filter((r) => r.is_modified)
        .map((r) => ({ row_index: r.row_index, data: r.data }))

      const file = await extractionsAPI.submit(batch.id, modifiedRecords)
      setSubmittedFile(file)
      setStep('done')
    } catch (err) {
      setSubmitError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setStep('configure')
    setBatch(null)
    setRecords([])
    setSubmittedFile(null)
    setSubmitError(null)
    setStep1Error(null)
    setSelectedTable('')
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Data Extraction</h1>
          <p className="text-slate-500 text-sm mt-1">
            Extract, review, and submit data from your database connections
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(['configure', 'edit', 'done'] as Step[]).map((s, idx) => {
            const labels = ['Configure', 'Review & Edit', 'Complete']
            const isActive = step === s
            const isDone =
              (s === 'configure' && (step === 'edit' || step === 'done')) ||
              (s === 'edit' && step === 'done')
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium',
                    isActive ? 'text-blue-600' : isDone ? 'text-emerald-600' : 'text-slate-400'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {isDone ? <CheckCircle2 size={14} /> : idx + 1}
                  </div>
                  {labels[idx]}
                </div>
                {idx < 2 && (
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        {/* ---- STEP 1: Configure ---- */}
        {step === 'configure' && (
          <div className="card p-6 max-w-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-5">
              Configure Extraction
            </h2>

            {step1Error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4 flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {step1Error}
              </div>
            )}

            <div className="space-y-4">
              {/* Connection */}
              <div>
                <label className="label">Database Connection</label>
                {loadingConnections ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Spinner size="sm" /> Loading connections...
                  </div>
                ) : (
                  <select
                    value={selectedConnection}
                    onChange={(e) =>
                      setSelectedConnection(e.target.value ? Number(e.target.value) : '')
                    }
                    className="input-field"
                  >
                    <option value="">Select a connection...</option>
                    {connections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.db_type} · {c.host}:{c.port})
                      </option>
                    ))}
                  </select>
                )}
                {connections.length === 0 && !loadingConnections && (
                  <p className="text-xs text-slate-400 mt-1">
                    No active connections found. Add one in the Connections page.
                  </p>
                )}
              </div>

              {/* Table */}
              <div>
                <label className="label">Table</label>
                {loadingTables ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Spinner size="sm" /> Loading tables...
                  </div>
                ) : (
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="input-field"
                    disabled={!selectedConnection || tables.length === 0}
                  >
                    <option value="">
                      {selectedConnection
                        ? tables.length > 0
                          ? 'Select a table...'
                          : 'No tables found'
                        : 'Select a connection first'}
                    </option>
                    {tables.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Batch size + offset */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Batch Size</label>
                  <input
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 100))}
                    min={1}
                    max={10000}
                    className="input-field"
                  />
                  <p className="text-xs text-slate-400 mt-1">Rows to fetch (1–10,000)</p>
                </div>
                <div>
                  <label className="label">Offset</label>
                  <input
                    type="number"
                    value={offset}
                    onChange={(e) => setOffset(Math.max(0, parseInt(e.target.value) || 0))}
                    min={0}
                    className="input-field"
                  />
                  <p className="text-xs text-slate-400 mt-1">Skip first N rows</p>
                </div>
              </div>

              <button
                onClick={handleExtract}
                disabled={!selectedConnection || !selectedTable || extracting}
                className="btn-primary w-full py-2.5"
              >
                {extracting ? (
                  <>
                    <Spinner size="sm" />
                    Extracting data...
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    Extract Data
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ---- STEP 2: Edit ---- */}
        {step === 'edit' && batch && (
          <div className="space-y-4">
            {/* Batch info */}
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Table: </span>
                  <span className="font-semibold text-slate-800">{batch.table_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Batch size: </span>
                  <span className="font-semibold text-slate-800">{batch.batch_size}</span>
                </div>
                <div>
                  <span className="text-slate-400">Offset: </span>
                  <span className="font-semibold text-slate-800">{batch.offset}</span>
                </div>
                <div>
                  <span className="text-slate-400">Row count: </span>
                  <span className="font-semibold text-slate-800">{batch.row_count}</span>
                </div>
                <div>
                  <span
                    className={cn(
                      'badge',
                      batch.status === 'completed'
                        ? 'badge-green'
                        : batch.status === 'pending'
                        ? 'badge-yellow'
                        : 'badge-blue'
                    )}
                  >
                    {batch.status}
                  </span>
                </div>
                <div className="ml-auto flex gap-2">
                  <button onClick={handleReset} className="btn-secondary text-xs px-3 py-1.5">
                    Start Over
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || loadingRecords}
                    className="btn-success"
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Submit Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
              {submitError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {submitError}
                </div>
              )}
            </div>

            {/* Data grid */}
            {loadingRecords ? (
              <InlineSpinner text="Loading records..." />
            ) : (
              <div className="card p-4">
                <DataGrid
                  columns={batch.columns}
                  rows={records}
                  onDataChange={handleDataChange}
                />
              </div>
            )}
          </div>
        )}

        {/* ---- STEP 3: Done ---- */}
        {step === 'done' && submittedFile && (
          <div className="card p-10 max-w-lg mx-auto text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Extraction Complete!
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              Your data has been processed and saved successfully.
            </p>

            <div className="bg-slate-50 rounded-lg p-4 text-left space-y-2 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Format:</span>
                <span className="font-medium text-slate-700 uppercase">
                  {submittedFile.file_format}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">File size:</span>
                <span className="font-medium text-slate-700">
                  {formatBytes(submittedFile.file_size)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Batch ID:</span>
                <span className="font-medium text-slate-700">#{submittedFile.batch}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={handleReset} className="btn-secondary">
                New Extraction
              </button>
              <a href="/files" className="btn-primary">
                <Download size={15} />
                View Files
              </a>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
