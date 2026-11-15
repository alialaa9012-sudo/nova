import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/** One row of a field group: an icon, the label in small type, the value under it, and the error below. */
export function IconField({
  id,
  label,
  icon: Icon,
  error,
  optional,
  children,
}: {
  id: string
  label: string
  icon: LucideIcon
  error?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className="px-3 py-2.5 lg:px-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-control text-[#3a271a]" aria-hidden="true">
          <Icon className="size-[19px]" />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <Label htmlFor={id} className="px-1.5 text-[11.5px] leading-4 font-extrabold text-muted-foreground">
            {label}
            {optional ? <span className="font-semibold"> (اختياري)</span> : null}
          </Label>
          {children}
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 ps-[50px] text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
