import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { Order } from '@/lib/api'
import { getBranch } from '@/lib/catalog'
import { formatCairoDateTime, formatEGP } from '@/lib/format'
import { nextStatus, statusLabel } from '@/lib/orderStatus'
import { cn } from '@/lib/utils'

export function OrderCard({
  order,
  now,
  onAdvance,
  onCancel,
  onOpen,
}: {
  order: Order
  now: Date
  onAdvance: () => void
  onCancel: () => void
  onOpen: () => void
}) {
  const branch = getBranch(order.branchId)
  const next = nextStatus(order.status)
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(order.createdAt)) / 60_000))
  const waiting = order.status === 'new' || order.status === 'preparing'
  // Wait time is the board's urgency signal: calm, then warning from 10 minutes, urgent from 20.
  const age = !waiting ? 'text-muted-foreground' : minutes >= 20 ? 'bg-danger-soft text-danger-ink' : minutes >= 10 ? 'bg-warning-soft text-warning-ink' : 'bg-closed-soft text-closed-ink'
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <h2 dir="ltr" className="text-xl font-extrabold">
            {order.number}
          </h2>
          <span className="rounded-full bg-closed-soft px-2 py-0.5 text-xs font-semibold text-closed-ink">فرع {branch?.name}</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold">{order.orderType === 'delivery' ? 'توصيل' : 'استلام'}</span>
          <span className={cn('ms-auto rounded-full text-xs font-bold tabular-nums', waiting && 'px-2.5 py-1', age)}>منذ {minutes} دقيقة</span>
        </CardTitle>
        <CardDescription>
          {statusLabel(order.status, order.orderType)} · {formatCairoDateTime(order.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <p>
          <span className="font-semibold">{order.customerName}</span> ·{' '}
          <a href={`tel:${order.phone}`} dir="ltr" className="underline underline-offset-2">
            {order.phone}
          </a>
        </p>
        {order.orderType === 'delivery' ? (
          <p>
            {order.zoneLabel} · {order.street} · عمارة {order.building}
          </p>
        ) : null}
        {/* The items on the card itself, so the agent can read or key in the order without opening it. */}
        <ul className="grid gap-0.5 rounded-xl bg-control px-3 py-2">
          {order.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {l.qty} × {l.name}
                {l.sizeLabel ? ` (${l.sizeLabel})` : ''}
              </span>
              <span className="shrink-0 tabular-nums">{formatEGP(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {order.notes ? <p className="rounded-xl bg-warning-soft px-3 py-2 text-warning-ink">ملاحظات: {order.notes}</p> : null}
        <p className="font-bold">{formatEGP(order.totals.total)} كاش</p>
        {order.status === 'cancelled' && order.cancelReason ? <p className="font-semibold text-danger">سبب الإلغاء: {order.cancelReason}</p> : null}
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        {next ? <Button onClick={onAdvance}>{`نقل إلى: ${statusLabel(next, order.orderType)}`}</Button> : null}
        <Button variant="outline" onClick={onOpen}>
          التفاصيل
        </Button>
        {order.status !== 'cancelled' ? (
          <Button variant="ghost" className="text-danger" onClick={onCancel}>
            إلغاء
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}
