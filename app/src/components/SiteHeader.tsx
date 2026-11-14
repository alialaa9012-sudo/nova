import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { brand } from '@/lib/catalog'
import { cn } from '@/lib/utils'

/** Square 44px control used in page headers. */
export const headerButton =
  'relative grid size-11 shrink-0 place-items-center rounded-2xl bg-control text-foreground shadow-card outline-none hover:bg-brand-tint focus-visible:ring-3 focus-visible:ring-ring/50'

export function SiteHeader({
  title,
  backTo,
  backLabel = 'رجوع',
  wide = false,
  narrow = false,
  logo = false,
  children,
}: {
  title?: string
  backTo?: string
  backLabel?: string
  /** Staff screens: wider container. */
  wide?: boolean
  /** Form pages: same narrow column as their content. */
  narrow?: boolean
  /** The logo shows on the home page and the staff board only. */
  logo?: boolean
  children?: ReactNode
}) {
  return (
    // A header that carries the logo is tall, so it scrolls away instead of staying pinned.
    <header className={cn('z-30 bg-background', logo ? 'relative' : 'sticky top-[env(safe-area-inset-top,0px)]')}>
      <div className={cn('mx-auto flex min-h-[68px] items-center gap-3 px-5 py-3 md:px-6', wide ? 'max-w-[1280px]' : narrow ? 'max-w-3xl' : 'max-w-[1200px]')}>
        {backTo ? (
          <Link to={backTo} className={headerButton}>
            <ArrowRight className="size-5" aria-hidden="true" />
            <span className="sr-only">{backLabel}</span>
          </Link>
        ) : null}
        {logo ? (
          <Link to="/" className="shrink-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <img src={brand.logoUrl} alt="خليها مشاوي" width={brand.logoWidth} height={brand.logoHeight} className={cn('w-auto', wide ? 'h-16' : 'h-24 md:h-28')} />
          </Link>
        ) : null}
        {title ? <p className="truncate text-lg leading-[26px] font-bold">{title}</p> : null}
        {children ? <div className="ms-auto flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
    </header>
  )
}
