const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export const setTokens = (access: string, refresh: string): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
}

export const setAccessToken = (access: string): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
}

export const clearTokens = (): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export const isAuthenticated = (): boolean => {
  return !!getToken()
}
