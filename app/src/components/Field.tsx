import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Field({
  id,
  label,
  error,
  optional,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  optional?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (اختياري)</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
