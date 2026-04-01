export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'user'
  date_joined: string
}

export interface DatabaseConnection {
  id: number
  name: string
  db_type: 'postgresql' | 'mysql' | 'mongodb' | 'clickhouse'
  host: string
  port: number
  database: string
  username: string
  is_active: boolean
  created_at: string
}

export interface DatabaseConnectionCreate {
  name: string
  db_type: 'postgresql' | 'mysql' | 'mongodb' | 'clickhouse'
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface ExtractionBatch {
  id: number
  connection: number
  connection_name?: string
  table_name: string
  batch_size: number
  offset: number
  status: string
  row_count: number
  columns: string[]
  created_at: string
}

export interface DataRecord {
  id: number
  batch: number
  row_index: number
  data: Record<string, unknown>
  is_modified: boolean
}

export interface StoredFile {
  id: number
  batch: number
  file_format: 'json' | 'csv'
  file_path: string
  file_size: number
  created_by: number
  created_at: string
  shared_with: number[]
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterCredentials {
  username: string
  email: string
  password: string
  password2: string
}

export interface TokenResponse {
  access: string
  refresh: string
}

export interface ApiError {
  detail?: string
  message?: string
  [key: string]: unknown
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
