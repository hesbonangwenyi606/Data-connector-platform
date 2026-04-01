'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { extractErrorMessage } from '@/lib/utils'
import Spinner from '@/components/Spinner'

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username too long')
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters'),
    password2: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.password2, {
    message: "Passwords don't match",
    path: ['password2'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showPassword2, setShowPassword2] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setError(null)
    setIsLoading(true)
    try {
      await registerUser(data)
      setSuccess(true)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus size={24} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Account created!</h2>
            <p className="text-slate-500 mt-2 mb-6">
              Your account has been created successfully.
            </p>
            <Link href="/login" className="btn-primary w-full justify-center">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UserPlus size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-slate-400 mt-1">Join the Data Connector Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="label">Username</label>
              <input
                {...register('username')}
                type="text"
                className="input-field"
                placeholder="john_doe"
                autoComplete="username"
                autoFocus
              />
              {errors.username && (
                <p className="error-text">{errors.username.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                className="input-field"
                placeholder="john@example.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="error-text">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="error-text">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <input
                  {...register('password2')}
                  type={showPassword2 ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword2((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password2 && (
                <p className="error-text">{errors.password2.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full py-2.5 text-base mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
