import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-4',
  }

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-slate-300 border-t-blue-600',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  )
}

export function InlineSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8">
      <Spinner />
      <span className="text-sm text-slate-500">{text}</span>
    </div>
  )
}
