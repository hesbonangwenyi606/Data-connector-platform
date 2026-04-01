import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusBadgeClass(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'badge-yellow',
    processing: 'badge-blue',
    completed: 'badge-green',
    failed: 'badge-red',
    active: 'badge-green',
    inactive: 'badge-gray',
  }
  return statusMap[status?.toLowerCase()] || 'badge-gray'
}

export function getDbTypeLabel(dbType: string): string {
  const labels: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mongodb: 'MongoDB',
    clickhouse: 'ClickHouse',
  }
  return labels[dbType] || dbType
}

export function extractErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred'
  if (typeof error === 'string') return error

  const axiosError = error as {
    response?: { data?: { detail?: string; message?: string; [key: string]: unknown } }
    message?: string
  }

  if (axiosError.response?.data) {
    const data = axiosError.response.data
    if (data.detail) return data.detail
    if (data.message) return data.message

    const firstKey = Object.keys(data)[0]
    if (firstKey) {
      const val = data[firstKey]
      if (Array.isArray(val)) return `${firstKey}: ${val[0]}`
      if (typeof val === 'string') return `${firstKey}: ${val}`
    }
  }

  if (axiosError.message) return axiosError.message
  return 'An unexpected error occurred'
}
