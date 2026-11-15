import { Phone, Plus } from 'lucide-react'
import type { MenuItem } from '@/lib/catalog'
import { cn } from '@/lib/utils'
import { ItemImage } from './ItemImage'

const BADGE_COLORS = { a: 'bg-badge-a text-white', b: 'bg-badge-b text-foreground', c: 'bg-badge-c text-white' }

/**
 * A menu item: its photo (or drawn sign) and its name, with a «+». Prices and sizes appear when the
 * item is opened. The whole card is the press target; items booked ahead show a call link instead.
 */
export function ItemCard({ item, phone, onAdd }: { item: MenuItem; phone: string; onAdd: () => void }) {
  return (
    <li
      className={cn(
        'relative flex flex-col rounded-[20px] border border-border bg-card p-1.5 pb-2.5 shadow-card focus-within:ring-3 focus-within:ring-ring/50 has-[button:hover]:bg-control lg:rounded-[22px]',
        'before:pointer-events-none before:absolute before:inset-[3px] before:rounded-[17px] before:border before:border-gold/25 lg:before:rounded-[19px]',
      )}
    >
      <ItemImage src={item.image} name={item.name} category={item.category} className="aspect-[1/0.74] rounded-[15px]" iconClassName="size-11 md:size-12" />
      {item.badge ? (
        <span className={cn('absolute start-3 top-3 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-bold', BADGE_COLORS[item.badge.style])}>{item.badge.text}</span>
      ) : null}
      <div className="flex items-center gap-2 px-1.5 pt-2">
        <p className="min-w-0 flex-1 font-naskh text-[18px] leading-[26px] font-bold lg:text-[18px]">{item.name}</p>
        {item.advanceNoticeHours ? (
          <a
            href={`tel:${phone}`}
            className="relative z-10 inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-control px-3 text-[13px] font-bold ring-1 ring-border outline-none hover:bg-gold-soft focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Phone className="size-4" aria-hidden="true" /> احجز <span className="sr-only">{item.name}</span>
          </a>
        ) : (
          // The pseudo-element stretches over the whole card, so the card opens the item too.
          <button
            type="button"
            aria-label={`أضف ${item.name}`}
            onClick={onAdd}
            className="grid size-[34px] shrink-0 place-items-center rounded-full bg-linear-to-br from-[#3a271a] to-brand text-gold-hi outline-none after:absolute after:inset-0 after:content-[''] hover:to-brand-pressed"
          >
            <Plus className="size-[18px] stroke-[2.6]" aria-hidden="true" />
          </button>
        )}
      </div>
      {item.advanceNoticeHours ? (
        <p className="px-1.5 pt-1 text-[11px] leading-4 font-semibold text-brand-text">بالحجز المسبق قبل {item.advanceNoticeHours} ساعة عبر الهاتف</p>
      ) : null}
    </li>
  )
}
