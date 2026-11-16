import { Minus, Plus } from 'lucide-react'
import { MAX_QTY } from '@/lib/cart'
import { cn } from '@/lib/utils'

const round = 'grid shrink-0 place-items-center rounded-xl bg-chip outline-none hover:bg-gold-soft focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45'

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = MAX_QTY,
  decreaseLabel = 'تقليل الكمية',
  increaseLabel = 'زيادة الكمية',
  compact = false,
}: {
  value: number
  onChange: (qty: number) => void
  min?: number
  max?: number
  decreaseLabel?: string
  increaseLabel?: string
  /** Smaller pill for rows of the cart. */
  compact?: boolean
}) {
  // The cart's small buttons keep their look but answer a 44px touch, like every other control.
  const button = cn(round, compact ? "relative size-[30px] rounded-[10px] after:absolute after:-inset-[7px] after:content-['']" : 'size-[42px]')
  return (
    <div className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-2xl bg-card p-[5px] ring-1 ring-border', compact ? 'h-10' : 'h-14')}>
      <button type="button" className={button} aria-label={decreaseLabel} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-7 text-center text-base leading-[22px] font-bold tabular-nums" aria-live="polite" data-testid="qty">
        {value}
      </span>
      <button type="button" className={button} aria-label={increaseLabel} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
