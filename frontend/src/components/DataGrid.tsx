'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DataRecord } from '@/types'

interface DataGridProps {
  columns: string[]
  rows: DataRecord[]
  onDataChange: (updatedRows: DataRecord[]) => void
}

type SortDirection = 'asc' | 'desc' | null

const PAGE_SIZE = 50

export default function DataGrid({ columns, rows, onDataChange }: DataGridProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: number; col: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [page, setPage] = useState(0)

  // Sort logic
  const sortedRows = useMemo(() => {
    if (!sortCol || !sortDir) return rows
    return [...rows].sort((a, b) => {
      const valA = a.data[sortCol]
      const valB = b.data[sortCol]
      if (valA == null && valB == null) return 0
      if (valA == null) return 1
      if (valB == null) return -1
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA
      }
      const strA = String(valA)
      const strB = String(valB)
      return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
    })
  }, [rows, sortCol, sortDir])

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE)
  const pagedRows = useMemo(
    () => sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedRows, page]
  )

  const handleSort = useCallback(
    (col: string) => {
      if (sortCol !== col) {
        setSortCol(col)
        setSortDir('asc')
      } else if (sortDir === 'asc') {
        setSortDir('desc')
      } else if (sortDir === 'desc') {
        setSortCol(null)
        setSortDir(null)
      }
      setPage(0)
    },
    [sortCol, sortDir]
  )

  const startEdit = (row: DataRecord, col: string) => {
    setEditingCell({ rowId: row.id, col })
    const val = row.data[col]
    setEditValue(val == null ? '' : String(val))
  }

  const commitEdit = useCallback(
    (row: DataRecord, col: string) => {
      const updatedRows = rows.map((r) => {
        if (r.id !== row.id) return r
        return {
          ...r,
          is_modified: true,
          data: { ...r.data, [col]: editValue },
        }
      })
      onDataChange(updatedRows)
      setEditingCell(null)
    },
    [rows, editValue, onDataChange]
  )

  const cancelEdit = () => {
    setEditingCell(null)
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ChevronsUpDown size={14} className="text-slate-400" />
    if (sortDir === 'asc') return <ChevronUp size={14} className="text-blue-600" />
    return <ChevronDown size={14} className="text-blue-600" />
  }

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        No columns to display
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Row count */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {rows.length} row{rows.length !== 1 ? 's' : ''} total
          {rows.filter((r) => r.is_modified).length > 0 && (
            <span className="ml-2 text-amber-600 font-medium">
              ({rows.filter((r) => r.is_modified).length} modified)
            </span>
          )}
        </span>
        {totalPages > 1 && (
          <span>
            Page {page + 1} of {totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg scrollbar-thin">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="table-header w-12 text-center">#</th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="table-header cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    <span>{col}</span>
                    <SortIcon col={col} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="text-center py-8 text-slate-400 italic"
                >
                  No data
                </td>
              </tr>
            ) : (
              pagedRows.map((row, rowIdx) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-slate-100 transition-colors',
                    row.is_modified ? 'bg-amber-50' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                    'hover:bg-blue-50/40'
                  )}
                >
                  <td className="table-cell text-center text-slate-400 text-xs">
                    {row.row_index + 1}
                  </td>
                  {columns.map((col) => {
                    const isEditing =
                      editingCell?.rowId === row.id && editingCell?.col === col
                    const cellValue = row.data[col]

                    return (
                      <td
                        key={col}
                        className="table-cell max-w-[200px] cursor-pointer"
                        onClick={() => !isEditing && startEdit(row, col)}
                        title="Click to edit"
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(row, col)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(row, col)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                          />
                        ) : (
                          <span
                            className={cn(
                              'block truncate',
                              cellValue == null && 'text-slate-300 italic'
                            )}
                          >
                            {cellValue == null ? 'null' : String(cellValue)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary px-2 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let pageNum: number
            if (totalPages <= 7) {
              pageNum = i
            } else if (page < 4) {
              pageNum = i
            } else if (page > totalPages - 5) {
              pageNum = totalPages - 7 + i
            } else {
              pageNum = page - 3 + i
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={cn(
                  'w-8 h-8 text-sm rounded-lg font-medium transition-colors',
                  pageNum === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                )}
              >
                {pageNum + 1}
              </button>
            )
          })}

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="btn-secondary px-2 py-1.5 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
