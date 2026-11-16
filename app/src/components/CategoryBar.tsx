import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const calm = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const arrow =
  'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-card text-foreground shadow-nav outline-none hover:bg-control focus-visible:ring-3 focus-visible:ring-ring/50 lg:grid'

/**
 * The categories as words in the Naskh face, with gold diamonds between them; the active one is a
 * brown pill framed in gold, kept in view. Phones swipe the row (a fade at each edge shows there is
 * more); from 1024px every category is shown on wrapped rows.
 */
export function CategoryBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: { id: string; name: string }[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ start: false, end: false })

  // How far the bar can still scroll towards each side. In RTL scrollLeft runs from 0 to negative.
  const measure = useCallback(() => {
    const box = bar.current
    if (!box) return
    const done = Math.abs(box.scrollLeft)
    const left = box.scrollWidth - box.clientWidth - done
    setMore({ start: done > 1, end: left > 1 })
  }, [])

  useEffect(() => {
    const box = bar.current
    if (!box) return
    measure()
    box.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(box)
    return () => {
      box.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [measure, categories.length])

  useEffect(() => {
    const box = bar.current
    const chip = box?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!box || !chip || typeof box.scrollBy !== 'function') return
    const a = chip.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    // Works in both directions: move the bar by the distance between the two centres.
    box.scrollBy({ left: a.left + a.width / 2 - (b.left + b.width / 2), behavior: calm() ? 'auto' : 'smooth' })
  }, [activeId])

  /** towards = 'start' moves back to the first chips, 'end' shows the next ones. */
  function page(towards: 'start' | 'end') {
    const box = bar.current
    if (!box) return
    const rtl = getComputedStyle(box).direction === 'rtl'
    const step = box.clientWidth * 0.75 * (towards === 'end' ? 1 : -1) * (rtl ? -1 : 1)
    box.scrollBy({ left: step, behavior: calm() ? 'auto' : 'smooth' })
  }

  const fade = `linear-gradient(to left, ${more.start ? 'transparent' : 'black'}, black 2rem, black calc(100% - 2rem), ${more.end ? 'transparent' : 'black'})`

  return (
    <nav aria-label="أقسام المنيو" className="relative">
      <div
        ref={bar}
        className="-mx-4 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:-mx-6 md:px-6 lg:mx-0 lg:overflow-visible lg:px-0 lg:[mask-image:none]!"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      >
        <ul className="flex w-max items-center gap-x-1 lg:w-auto lg:flex-wrap lg:gap-y-2.5">
          {categories.map((c, i) => {
            const active = c.id === activeId
            return (
              <li key={c.id} className="flex items-center gap-x-1">
                {i > 0 ? <span className="mx-1 size-1.5 rotate-45 bg-gold/70" aria-hidden="true" /> : null}
                <a
                  href={`#${c.id}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    onSelect(c.id)
                  }}
                  className={cn(
                    'relative flex h-11 items-center rounded-full px-2 font-naskh text-[19px] leading-none font-bold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:text-[21px]',
                    active
                      ? 'bg-linear-to-br from-[#3a271a] to-brand px-[18px] text-primary-foreground ring-1 ring-gold before:absolute before:start-[7px] before:size-[5px] before:rotate-45 before:bg-gold-hi after:absolute after:end-[7px] after:size-[5px] after:rotate-45 after:bg-gold-hi'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="pb-1">{c.name}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
      {/* Decorative helpers for mouse users; keyboard and screen-reader users reach every chip through the list itself. */}
      {more.start ? (
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page('start')} className={cn(arrow, '-start-3')}>
          <ChevronRight className="size-5" />
        </button>
      ) : null}
      {more.end ? (
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page('end')} className={cn(arrow, '-end-3')}>
          <ChevronLeft className="size-5" />
        </button>
      ) : null}
    </nav>
  )
}
