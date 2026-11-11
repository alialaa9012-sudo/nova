import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

export function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string
  label: string
  error?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (اختياري)</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
