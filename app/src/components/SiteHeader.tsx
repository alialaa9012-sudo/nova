import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { brand } from '@/lib/catalog'
import { cn } from '@/lib/utils'

export function SiteHeader({
  title,
  backTo,
  backLabel = 'رجوع',
  wide = false,
  children,
}: {
  title?: string
  backTo?: string
  backLabel?: string
  wide?: boolean
  children?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 bg-black text-white">
      <div className={cn('mx-auto flex items-center gap-2 px-4 py-2', wide ? 'max-w-6xl' : 'max-w-3xl')}>
        {backTo ? (
          <Link to={backTo} className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
            <ArrowRight className="size-5" aria-hidden="true" />
            <span className="sr-only">{backLabel}</span>
          </Link>
        ) : null}
        <Link to="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-white">
          <img src={brand.logoUrl} alt="خليها مشاوي" width={84} height={56} className="h-14 w-auto" />
        </Link>
        {title ? <p className="truncate text-lg font-bold">{title}</p> : null}
        {children ? <div className="ms-auto flex items-center gap-2">{children}</div> : null}
      </div>
    </header>
  )
}
