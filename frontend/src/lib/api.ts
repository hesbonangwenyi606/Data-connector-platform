import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import {
  DatabaseConnection,
  DatabaseConnectionCreate,
  DataRecord,
  ExtractionBatch,
  LoginCredentials,
  RegisterCredentials,
  StoredFile,
  TokenResponse,
  User,
} from '@/types'
import {
  clearTokens,
  getRefreshToken,
  getToken,
  setAccessToken,
  setTokens,
} from './auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ---- Request interceptor: attach access token ----
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ---- Response interceptor: handle 401 → refresh → retry ----
let isRefreshing = false
let pendingRequests: Array<(token: string) => void> = []

const processPendingRequests = (token: string) => {
  pendingRequests.forEach((callback) => callback(token))
  pendingRequests = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/token/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
            }
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearTokens()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      try {
        const response = await axios.post<{ access: string }>(
          `${BASE_URL}/token/refresh/`,
          { refresh: refreshToken }
        )
        const newAccessToken = response.data.access
        setAccessToken(newAccessToken)
        processPendingRequests(newAccessToken)
        isRefreshing = false

        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`
        }
        return apiClient(originalRequest)
      } catch {
        isRefreshing = false
        pendingRequests = []
        clearTokens()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

// ---- Auth API ----
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/token/', credentials)
    return response.data
  },

  register: async (credentials: RegisterCredentials): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register/', credentials)
    return response.data
  },

  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/profile/')
    return response.data
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post<{ access: string }>('/token/refresh/', { refresh })
    return response.data
  },
}

// Helper to unwrap DRF paginated responses
type MaybePagedResponse<T> = T[] | { results: T[]; count: number }
function unwrapList<T>(data: MaybePagedResponse<T>): T[] {
  if (Array.isArray(data)) return data
  return data.results ?? []
}

// ---- Connectors API ----
export const connectorsAPI = {
  list: async (): Promise<DatabaseConnection[]> => {
    const response = await apiClient.get<MaybePagedResponse<DatabaseConnection>>('/connectors/')
    return unwrapList(response.data)
  },

  create: async (data: DatabaseConnectionCreate): Promise<DatabaseConnection> => {
    const response = await apiClient.post<DatabaseConnection>('/connectors/', data)
    return response.data
  },

  update: async (id: number, data: Partial<DatabaseConnectionCreate>): Promise<DatabaseConnection> => {
    const response = await apiClient.patch<DatabaseConnection>(`/connectors/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/connectors/${id}/`)
  },

  test: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/connectors/${id}/test/`
    )
    return response.data
  },

  getTables: async (id: number): Promise<string[]> => {
    const response = await apiClient.get<{ tables: string[] }>(`/connectors/${id}/tables/`)
    return response.data.tables
  },

  fetchData: async (
    id: number,
    table: string,
    batchSize: number = 100,
    offset: number = 0
  ): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> => {
    const response = await apiClient.get(
      `/connectors/${id}/fetch/?table=${encodeURIComponent(table)}&batch_size=${batchSize}&offset=${offset}`
    )
    return response.data
  },
}

// ---- Extractions API ----
export const extractionsAPI = {
  list: async (): Promise<ExtractionBatch[]> => {
    const response = await apiClient.get<MaybePagedResponse<ExtractionBatch>>('/extractions/')
    return unwrapList(response.data)
  },

  create: async (data: {
    connection: number
    table_name: string
    batch_size: number
    offset: number
  }): Promise<ExtractionBatch> => {
    const response = await apiClient.post<ExtractionBatch>('/extractions/', data)
    return response.data
  },

  submit: async (
    id: number,
    records: { row_index: number; data: Record<string, unknown> }[]
  ): Promise<{ message: string; updated_count: number }> => {
    const response = await apiClient.post<{ message: string; updated_count: number }>(
      `/extractions/${id}/submit/`,
      { records }
    )
    return response.data
  },

  getRecords: async (id: number): Promise<DataRecord[]> => {
    const response = await apiClient.get<MaybePagedResponse<DataRecord>>(
      `/extractions/${id}/records/`
    )
    return unwrapList(response.data)
  },
}

// ---- Storage API ----
export const storageAPI = {
  list: async (): Promise<StoredFile[]> => {
    const response = await apiClient.get<MaybePagedResponse<StoredFile>>('/storage/')
    return unwrapList(response.data)
  },

  download: async (id: number): Promise<Blob> => {
    const response = await apiClient.get(`/storage/${id}/download/`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Accepts a username; the backend resolves it to a user ID
  share: async (id: number, username: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/storage/${id}/share/`, { username })
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/storage/${id}/`)
  },
}

// ---- Users API ----
export const usersAPI = {
  list: async (): Promise<User[]> => {
    const response = await apiClient.get<MaybePagedResponse<User>>('/auth/users/')
    return unwrapList(response.data)
  },
}

export default apiClient
