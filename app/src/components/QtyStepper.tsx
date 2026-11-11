import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MAX_QTY } from '@/lib/cart'

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = MAX_QTY,
  decreaseLabel = 'تقليل الكمية',
  increaseLabel = 'زيادة الكمية',
}: {
  value: number
  onChange: (qty: number) => void
  min?: number
  max?: number
  decreaseLabel?: string
  increaseLabel?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon-lg" className="size-11" aria-label={decreaseLabel} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus aria-hidden="true" />
      </Button>
      <span className="min-w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite" data-testid="qty">
        {value}
      </span>
      <Button type="button" variant="outline" size="icon-lg" className="size-11" aria-label={increaseLabel} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus aria-hidden="true" />
      </Button>
    </div>
  )
}
