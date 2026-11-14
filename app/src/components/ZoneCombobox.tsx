import { Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { fieldProps } from '@/lib/a11y'
import type { DeliveryZone } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { searchKey } from '@/lib/text'
import { cn } from '@/lib/utils'

const display = (zone: DeliveryZone) => `${zone.label} · ${formatEGP(zone.fee)}`

/**
 * Delivery zone picker: type to filter the branch zones, then choose one.
 * Same zones and fees as before; `onChange('')` means nothing is chosen.
 */
export function ZoneCombobox({
  id,
  zones,
  value,
  onChange,
  error,
}: {
  id: string
  zones: DeliveryZone[]
  value: string
  onChange: (zoneId: string) => void
  error?: string
}) {
  const listId = useId()
  const list = useRef<HTMLUListElement>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const selected = zones.find((z) => z.id === value)
  // With a zone chosen and its name untouched, opening shows the whole list again.
  const wanted = selected && text === display(selected) ? '' : searchKey(text)
  const matches = wanted ? zones.filter((z) => searchKey(z.label).includes(wanted)) : zones
  const expanded = open && matches.length > 0
  const current = Math.min(active, matches.length - 1)

  useEffect(() => {
    if (expanded) list.current?.children[current]?.scrollIntoView?.({ block: 'nearest' })
  }, [expanded, current])

  function choose(zone: DeliveryZone) {
    onChange(zone.id)
    setText(display(zone))
    setOpen(false)
  }

  return (
    <div className="relative scroll-mt-24">
      <Search className="pointer-events-none absolute start-4 top-[26px] size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        {...fieldProps(id, error)}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? `${listId}-${current}` : undefined}
        autoComplete="off"
        placeholder="ابحث عن منطقتك"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setActive(0)
          setOpen(true)
          if (value) onChange('')
        }}
        onFocus={(e) => {
          setOpen(true)
          e.target.select()
        }}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
            setActive(Math.max(0, Math.min(matches.length - 1, current + (open ? (e.key === 'ArrowDown' ? 1 : -1) : 0))))
          } else if (e.key === 'Enter' && expanded) {
            e.preventDefault()
            choose(matches[current])
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
        className="h-[52px] w-full rounded-2xl border border-input bg-surface ps-12 pe-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive"
      />
      {expanded ? (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label="المناطق"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-[min(280px,40svh)] overflow-y-auto rounded-2xl bg-surface p-1 shadow-nav"
        >
          {matches.map((zone, i) => (
            <li
              key={zone.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={zone.id === value}
              // Keep the focus in the field, so choosing with a tap or click does not close the list first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(zone)}
              className={cn('flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-[15px]', i === current && 'bg-brand-tint')}
            >
              <span>{zone.label}</span>
              <span className="shrink-0 text-sm leading-5 font-bold tabular-nums">{formatEGP(zone.fee)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {open && matches.length === 0 ? (
        <p role="status" className="absolute inset-x-0 top-full z-20 mt-1 rounded-2xl bg-surface p-4 text-sm text-muted-foreground shadow-nav">
          لا توجد منطقة بهذا الاسم.
        </p>
      ) : null}
    </div>
  )
}
