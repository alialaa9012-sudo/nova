import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/** Horizontal category chips. The active chip is filled and kept in view. */
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

  useEffect(() => {
    const box = bar.current
    const chip = box?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!box || !chip || typeof box.scrollBy !== 'function') return
    const a = chip.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    // Works in both directions: move the bar by the distance between the two centres.
    box.scrollBy({ left: a.left + a.width / 2 - (b.left + b.width / 2), behavior: 'smooth' })
  }, [activeId])

  return (
    <nav aria-label="أقسام المنيو">
      <div ref={bar} className="-mx-5 overflow-x-auto px-5 py-2 [scrollbar-width:none] md:-mx-6 md:px-6">
        <ul className="flex w-max gap-2">
          {categories.map((c) => {
            const active = c.id === activeId
            return (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    onSelect(c.id)
                  }}
                  className={cn(
                    'flex h-10 items-center rounded-full px-4 text-[13px] leading-[18px] font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground shadow-card hover:bg-control',
                  )}
                >
                  {c.name}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
