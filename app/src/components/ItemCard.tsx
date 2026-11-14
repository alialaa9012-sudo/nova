import { Phone, Plus } from 'lucide-react'
import type { MenuItem } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ItemImage } from './ItemImage'

const BADGE_COLORS = { a: 'bg-badge-a text-white', b: 'bg-badge-b text-foreground', c: 'bg-badge-c text-white' }

/** A menu item: photo first, then name, description, price and the add button. */
export function ItemCard({ item, phone, onAdd }: { item: MenuItem; phone: string; onAdd: () => void }) {
  const lowest = Math.min(...item.sizes.map((s) => s.price))
  return (
    <li className="relative flex flex-col overflow-hidden rounded-[20px] bg-card shadow-card focus-within:ring-3 focus-within:ring-ring/50">
      <ItemImage src={item.image} />
      {item.badge ? (
        <span className={cn('absolute start-2 top-2 rounded-full px-2.5 py-1.5 text-[11px] leading-[14px] font-bold', BADGE_COLORS[item.badge.style])}>{item.badge.text}</span>
      ) : null}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[15px] leading-[22px] font-bold">{item.name}</p>
        {item.description ? <p className="line-clamp-2 text-xs leading-[18px] text-muted-foreground">{item.description}</p> : null}
        {item.advanceNoticeHours ? (
          <p className="text-xs leading-[18px] font-semibold text-brand-text">بالحجز المسبق قبل {item.advanceNoticeHours} ساعة عبر الهاتف</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="text-base leading-[22px] font-extrabold tabular-nums">
            {item.sizes.length > 1 ? <span className="text-xs font-normal text-muted-foreground">من </span> : null}
            {formatEGP(lowest)}
          </p>
          {item.advanceNoticeHours ? (
            <a
              href={`tel:${phone}`}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-control px-3 text-sm font-bold shadow-card outline-none hover:bg-brand-tint focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Phone className="size-4" aria-hidden="true" /> احجز <span className="sr-only">{item.name}</span>
            </a>
          ) : (
            // The whole card is the press target: the pseudo-element stretches over the card.
            <button
              type="button"
              aria-label={`أضف ${item.name}`}
              onClick={onAdd}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none after:absolute after:inset-0 after:content-[''] hover:bg-brand-pressed active:bg-brand-pressed"
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
