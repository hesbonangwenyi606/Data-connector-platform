'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI } from '@/lib/api'
import { clearTokens, isAuthenticated, setTokens } from '@/lib/auth'
import type { LoginCredentials, RegisterCredentials, User } from '@/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  register: (credentials: RegisterCredentials) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false)
      return
    }
    try {
      const profile = await authAPI.getProfile()
      setUser(profile)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const login = async (credentials: LoginCredentials) => {
    const tokens = await authAPI.login(credentials)
    setTokens(tokens.access, tokens.refresh)
    const profile = await authAPI.getProfile()
    setUser(profile)
    router.push('/')
  }

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
    router.push('/login')
  }, [router])

  const register = async (credentials: RegisterCredentials) => {
    await authAPI.register(credentials)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
