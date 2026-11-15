import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Native select (best on phones and for keyboard use) drawn like the app's other fields. */
export function SelectInput({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          'h-[52px] w-full appearance-none rounded-2xl border border-input bg-surface ps-4 pe-11 text-base outline-none focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
