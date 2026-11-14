import { Minus, Plus } from 'lucide-react'
import { MAX_QTY } from '@/lib/cart'
import { cn } from '@/lib/utils'

const round = 'grid shrink-0 place-items-center rounded-full outline-none hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45'

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
  const button = cn(round, compact ? 'size-8' : 'size-9')
  return (
    <div className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-chip px-1.5', compact ? 'h-10' : 'h-12')}>
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
