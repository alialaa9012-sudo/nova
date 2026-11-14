import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { HeroBanner as Banner } from '@/lib/catalog'
import { cn } from '@/lib/utils'

const cta = 'mt-1 inline-flex h-11 w-fit items-center gap-3 rounded-full bg-primary ps-5 pe-1.5 text-[15px] font-bold text-primary-foreground outline-none hover:bg-brand-pressed focus-visible:ring-3 focus-visible:ring-white/70'

/** Promotional banners on the home page. Renders nothing until the owner supplies content. */
export function HeroBanner({ banners, onBrowse }: { banners: Banner[]; onBrowse: () => void }) {
  const [current, setCurrent] = useState(0)
  if (banners.length === 0) return null
  const arrow = (
    <span className="grid size-8 place-items-center rounded-full bg-white text-brand-text">
      <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
    </span>
  )
  return (
    <section aria-label="العروض" className="mt-6">
      <ul
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none]"
        onScroll={(e) => {
          const el = e.currentTarget
          setCurrent(Math.round(Math.abs(el.scrollLeft) / el.clientWidth))
        }}
      >
        {banners.map((b) => (
          <li
            key={b.title}
            className="relative flex min-h-[200px] w-full shrink-0 snap-center overflow-hidden rounded-3xl from-hero-from to-hero-to text-white ltr:bg-linear-to-r rtl:bg-linear-to-l"
          >
            {b.image ? <img src={b.image} alt="" className="absolute inset-y-0 end-0 h-full w-1/2 object-cover" /> : null}
            <div className={cn('relative flex flex-col items-start justify-center gap-2 p-5', b.image ? 'w-3/5' : 'w-full')}>
              {b.badge ? <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] leading-[14px] font-bold">{b.badge}</span> : null}
              <p className="line-clamp-3 text-[22px] leading-7 font-extrabold">{b.title}</p>
              {b.description ? <p className="text-[13px] leading-5 text-white/85">{b.description}</p> : null}
              {b.branchId ? (
                <Link to={`/branch/${b.branchId}`} className={cta}>
                  {b.ctaLabel}
                  {arrow}
                </Link>
              ) : (
                <button type="button" onClick={onBrowse} className={cta}>
                  {b.ctaLabel}
                  {arrow}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {banners.length > 1 ? (
        <div aria-hidden="true" className="mt-2 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <span key={b.title} className={cn('h-1.5 rounded-full', i === current ? 'w-4 bg-primary' : 'w-1.5 bg-brand-soft')} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
