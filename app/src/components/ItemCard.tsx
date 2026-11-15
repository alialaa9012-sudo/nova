import { Phone, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MenuItem } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ItemImage } from './ItemImage'

const BADGE_COLORS = { a: 'bg-badge-a text-white', b: 'bg-badge-b text-foreground', c: 'bg-badge-c text-white' }

function Price({ item }: { item: MenuItem }) {
  const lowest = Math.min(...item.sizes.map((s) => s.price))
  return (
    <p className="text-base leading-[22px] font-extrabold tabular-nums">
      {item.sizes.length > 1 ? <span className="text-xs font-normal text-muted-foreground">من </span> : null}
      {formatEGP(lowest)}
    </p>
  )
}

/** «+» to open the item, or a call link for items that need booking ahead. The whole card is the press target. */
function Action({ item, phone, onAdd }: { item: MenuItem; phone: string; onAdd: () => void }) {
  if (item.advanceNoticeHours) {
    return (
      <a
        href={`tel:${phone}`}
        className="relative z-10 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-control px-3 text-sm font-bold shadow-card outline-none hover:bg-brand-tint focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Phone className="size-4" aria-hidden="true" /> احجز <span className="sr-only">{item.name}</span>
      </a>
    )
  }
  return (
    // The pseudo-element stretches over the whole card, so the card opens the item too.
    <button
      type="button"
      aria-label={`أضف ${item.name}`}
      onClick={onAdd}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none after:absolute after:inset-0 after:content-[''] hover:bg-brand-pressed active:bg-brand-pressed"
    >
      <Plus className="size-5" aria-hidden="true" />
    </button>
  )
}

function Details({ item, children }: { item: MenuItem; children?: ReactNode }) {
  return (
    <>
      <p className="text-[15px] leading-[22px] font-bold">{item.name}</p>
      {item.description ? <p className="line-clamp-2 text-xs leading-[18px] text-muted-foreground">{item.description}</p> : null}
      {item.advanceNoticeHours ? (
        <p className="text-xs leading-[18px] font-semibold text-brand-text">بالحجز المسبق قبل {item.advanceNoticeHours} ساعة عبر الهاتف</p>
      ) : null}
      {children}
    </>
  )
}

const pressable = 'relative overflow-hidden rounded-[20px] bg-card shadow-card focus-within:ring-3 focus-within:ring-ring/50 has-[button:hover]:bg-control'

/** A menu item with its photo on top, for sections that have photos. */
export function ItemCard({ item, phone, onAdd }: { item: MenuItem; phone: string; onAdd: () => void }) {
  return (
    <li className={cn(pressable, 'flex flex-col')}>
      <ItemImage src={item.image} />
      {item.badge ? (
        <span className={cn('absolute start-2 top-2 rounded-full px-2.5 py-1.5 text-[11px] leading-[14px] font-bold', BADGE_COLORS[item.badge.style])}>{item.badge.text}</span>
      ) : null}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Details item={item} />
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Price item={item} />
          <Action item={item} phone={phone} onAdd={onAdd} />
        </div>
      </div>
    </li>
  )
}

/**
 * A dense row for sections without photos, read like the printed menu: name and price on one line,
 * a one-line description, and a quiet «+» so the solid brand colour stays with the cart bar.
 */
export function ItemRow({ item, phone, onAdd }: { item: MenuItem; phone: string; onAdd: () => void }) {
  return (
    <li className="relative flex items-center gap-3 px-4 py-2.5 focus-within:z-10 focus-within:ring-3 focus-within:ring-ring/50 has-[button:hover]:bg-control">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-[15px] leading-[22px] font-bold">{item.name}</p>
          <Price item={item} />
        </div>
        {item.description ? <p className="line-clamp-1 text-xs leading-[18px] text-muted-foreground sm:line-clamp-2">{item.description}</p> : null}
        {item.advanceNoticeHours ? (
          <p className="text-xs leading-[18px] font-semibold text-brand-text">بالحجز المسبق قبل {item.advanceNoticeHours} ساعة عبر الهاتف</p>
        ) : null}
        {item.badge ? (
          <span className={cn('mt-0.5 w-fit rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-bold', BADGE_COLORS[item.badge.style])}>{item.badge.text}</span>
        ) : null}
      </div>
      {item.advanceNoticeHours ? (
        <Action item={item} phone={phone} onAdd={onAdd} />
      ) : (
        <button
          type="button"
          aria-label={`أضف ${item.name}`}
          onClick={onAdd}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-brand-text outline-none after:absolute after:inset-0 after:content-[''] hover:bg-brand-soft"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      )}
    </li>
  )
}
