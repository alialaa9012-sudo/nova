import { Check, X } from 'lucide-react'
import type { Order } from '@/lib/api/types'
import { formatCairoDateTime } from '@/lib/format'
import { STATUS_FLOW, statusLabel } from '@/lib/orderStatus'
import { cn } from '@/lib/utils'

/**
 * horizontal: the customer's view on the order page: three steps side by side, no times, and no
 * «تم التسليم» step (the customer knows they have the order). Otherwise the staff view: every step
 * one under the other with its time.
 */
export function StatusTimeline({ order, horizontal = false }: { order: Order; horizontal?: boolean }) {
  if (order.status === 'cancelled') {
    return (
      <ol className="grid gap-3" aria-label="حالة الطلب">
        {order.history.map((h, i) => (
          <li key={`${h.to}-${i}`} className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-white',
                h.to === 'cancelled' ? 'bg-danger' : 'bg-gold-deep',
              )}
            >
              {h.to === 'cancelled' ? <X className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            </span>
            <div>
              <p className="font-semibold">
                {statusLabel(h.to, order.orderType)}
                {h.to === 'cancelled' && order.cancelReason ? `: ${order.cancelReason}` : ''}
              </p>
              {horizontal ? null : <p className="text-xs text-muted-foreground">{formatCairoDateTime(h.at)}</p>}
            </div>
          </li>
        ))}
      </ol>
    )
  }

  const current = STATUS_FLOW.indexOf(order.status)
  if (horizontal) {
    const steps = STATUS_FLOW.filter((s) => s !== 'delivered')
    const reached = Math.min(current, steps.length - 1)
    return (
      <ol className="relative grid grid-cols-3 gap-1 before:absolute before:inset-x-[16%] before:top-4 before:h-0.5 before:bg-border" aria-label="حالة الطلب">
        {steps.map((status, i) => {
          const done = i <= reached
          const now = i === reached
          return (
            <li key={status} className="relative grid justify-items-center gap-1.5 text-center" aria-current={now ? 'step' : undefined}>
              <span
                className={cn(
                  'grid size-8 place-items-center rounded-full text-sm font-bold',
                  now
                    ? 'bg-linear-to-br from-[#3a271a] to-brand text-gold-hi ring-[5px] ring-gold/25'
                    : done
                      ? 'bg-gold text-brand'
                      : 'bg-control text-muted-foreground ring-2 ring-border',
                )}
              >
                {done ? <Check className="size-4 stroke-[2.6]" aria-hidden="true" /> : i + 1}
              </span>
              <p className={cn('text-xs leading-[18px] font-extrabold', !done && 'text-muted-foreground')}>{statusLabel(status, order.orderType)}</p>
            </li>
          )
        })}
      </ol>
    )
  }
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
                done ? 'border-gold bg-gold text-brand' : 'border-line text-muted-foreground',
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
