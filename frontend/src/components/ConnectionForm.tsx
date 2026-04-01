'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { DatabaseConnection, DatabaseConnectionCreate } from '@/types'
import Spinner from './Spinner'

const connectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  db_type: z.enum(['postgresql', 'mysql', 'mongodb', 'clickhouse'], {
    required_error: 'Database type is required',
  }),
  host: z.string().min(1, 'Host is required'),
  port: z
    .number({ invalid_type_error: 'Port must be a number' })
    .int()
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must be at most 65535'),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional(),
})

type ConnectionFormData = z.infer<typeof connectionSchema>

interface ConnectionFormProps {
  initialData?: DatabaseConnection | null
  onSubmit: (data: DatabaseConnectionCreate) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

const DB_TYPE_DEFAULTS: Record<string, number> = {
  postgresql: 5432,
  mysql: 3306,
  mongodb: 27017,
  clickhouse: 9000,
}

export default function ConnectionForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ConnectionFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          db_type: initialData.db_type,
          host: initialData.host,
          port: initialData.port,
          database: initialData.database,
          username: initialData.username,
          password: '',
        }
      : {
          db_type: 'postgresql',
          port: 5432,
        },
  })

  const dbType = watch('db_type')

  useEffect(() => {
    if (!initialData && dbType) {
      setValue('port', DB_TYPE_DEFAULTS[dbType] || 5432)
    }
  }, [dbType, initialData, setValue])

  const handleFormSubmit = async (data: ConnectionFormData) => {
    await onSubmit({
      name: data.name,
      db_type: data.db_type,
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username,
      password: data.password || '',
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Name */}
      <div>
        <label className="label">Connection Name</label>
        <input
          {...register('name')}
          className="input-field"
          placeholder="My PostgreSQL DB"
        />
        {errors.name && <p className="error-text">{errors.name.message}</p>}
      </div>

      {/* DB Type */}
      <div>
        <label className="label">Database Type</label>
        <select {...register('db_type')} className="input-field">
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mongodb">MongoDB</option>
          <option value="clickhouse">ClickHouse</option>
        </select>
        {errors.db_type && <p className="error-text">{errors.db_type.message}</p>}
      </div>

      {/* Host + Port */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">Host</label>
          <input
            {...register('host')}
            className="input-field"
            placeholder="localhost or 192.168.1.1"
          />
          {errors.host && <p className="error-text">{errors.host.message}</p>}
        </div>
        <div>
          <label className="label">Port</label>
          <input
            {...register('port', { valueAsNumber: true })}
            type="number"
            className="input-field"
            placeholder="5432"
          />
          {errors.port && <p className="error-text">{errors.port.message}</p>}
        </div>
      </div>

      {/* Database */}
      <div>
        <label className="label">Database Name</label>
        <input
          {...register('database')}
          className="input-field"
          placeholder="my_database"
        />
        {errors.database && <p className="error-text">{errors.database.message}</p>}
      </div>

      {/* Username */}
      <div>
        <label className="label">Username</label>
        <input
          {...register('username')}
          className="input-field"
          placeholder="db_user"
          autoComplete="username"
        />
        {errors.username && <p className="error-text">{errors.username.message}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="label">
          Password{initialData && ' (leave blank to keep current)'}
        </label>
        <input
          {...register('password')}
          type="password"
          className="input-field"
          placeholder={initialData ? '••••••••' : 'Enter password'}
          autoComplete="new-password"
        />
        {errors.password && <p className="error-text">{errors.password.message}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="sm" />
              Saving...
            </>
          ) : initialData ? (
            'Update Connection'
          ) : (
            'Create Connection'
          )}
        </button>
      </div>
    </form>
  )
}
