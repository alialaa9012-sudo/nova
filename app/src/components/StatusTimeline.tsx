import { Check, X } from 'lucide-react'
import type { Order } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'
import { STATUS_FLOW, statusLabel } from '@/lib/orderStatus'
import { cn } from '@/lib/utils'

export function StatusTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelled') {
    return (
      <ol className="grid gap-3" aria-label="حالة الطلب">
        {order.history.map((h, i) => (
          <li key={`${h.to}-${i}`} className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-white',
                h.to === 'cancelled' ? 'bg-red-700' : 'bg-stone-600',
              )}
            >
              {h.to === 'cancelled' ? <X className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            </span>
            <div>
              <p className="font-semibold">
                {statusLabel(h.to, order.orderType)}
                {h.to === 'cancelled' && order.cancelReason ? `: ${order.cancelReason}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">{formatCairoDateTime(h.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    )
  }

  const current = STATUS_FLOW.indexOf(order.status)
  return (
    <ol className="grid gap-3" aria-label="حالة الطلب">
      {STATUS_FLOW.map((status, i) => {
        const done = i <= current
        const at = order.history.find((h) => h.to === status)?.at
        return (
          <li key={status} className="flex items-center gap-3" aria-current={i === current ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                done ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-stone-400 text-stone-700',
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <div>
              <p className={cn('font-semibold', !done && 'text-muted-foreground')}>{statusLabel(status, order.orderType)}</p>
              {at ? <p className="text-xs text-muted-foreground">{formatCairoDateTime(at)}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
