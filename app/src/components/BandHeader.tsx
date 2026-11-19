import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { brand } from '@/lib/catalog'
import { cn } from '@/lib/utils'

/**
 * The dark band at the top of checkout, the order page and tracking: back button, the gold logo,
 * the branch name, then the page's own content. The page's sheet overlaps its lower edge.
 */
export function BandHeader({
  backTo,
  backLabel,
  branchName,
  children,
  wide = false,
  bigLogo = false,
}: {
  backTo: string
  backLabel: string
  branchName?: string
  children: ReactNode
  /** Checkout and the order page use two columns from 1024px. */
  wide?: boolean
  /** A larger logo, for the order page. */
  bigLogo?: boolean
}) {
  return (
    <header className="bg-hero-to bg-[radial-gradient(90%_100%_at_50%_0%,var(--hero-from),var(--hero-to)_80%)] text-band-ink lg:bg-[radial-gradient(70%_140%_at_50%_0%,var(--hero-from),var(--hero-to)_80%)]">
      <div className={cn('mx-auto px-4 pt-2 pb-[42px] md:px-6 lg:px-8 lg:pt-3.5 lg:pb-14', wide ? 'max-w-3xl lg:max-w-[1180px]' : 'max-w-xl')}>
        <div className="flex items-center gap-2.5 lg:gap-3.5">
          <Link
            to={backTo}
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/8 ring-1 ring-gold-hi/40 outline-none hover:bg-white/14 focus-visible:ring-3 focus-visible:ring-gold-hi/70"
          >
            <ArrowRight className="size-5" aria-hidden="true" />
            <span className="sr-only">{backLabel}</span>
          </Link>
          <img src={brand.logoGoldSmallUrl} alt="خليها مشاوي" width={brand.logoGoldWidth} height={brand.logoGoldHeight} className={cn('w-auto shrink-0', bigLogo ? 'h-16 lg:h-[72px]' : 'h-[52px] lg:h-[58px]')} />
          {branchName ? (
            <p className="grid min-w-0 border-s border-gold-hi/40 ps-2.5 leading-tight lg:ps-3">
              <span className="text-xs font-bold text-band-muted">فرع</span>
              <span className="truncate font-naskh text-lg font-bold lg:text-xl">{branchName}</span>
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </header>
  )
}

/** The cream sheet that overlaps the band. */
export function BandSheet({ children, wide = false, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <main id="content" tabIndex={-1} className={cn('relative mx-auto -mt-7 rounded-t-[28px] bg-background px-4 pt-2.5 outline-none md:px-6 lg:-mt-9 lg:rounded-t-[30px] lg:px-8 lg:pt-5', wide ? 'max-w-3xl lg:max-w-[1180px]' : 'max-w-xl', className)}>
      {children}
    </main>
  )
}
