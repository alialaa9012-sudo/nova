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
  return (
    <Card className={cn('h-full', order.status === 'new' && 'ring-2 ring-brand')}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <h2 dir="ltr">{order.number}</h2>
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-900">فرع {branch?.name}</span>
          <span className="rounded-full border px-2 py-0.5 text-xs font-semibold">{order.orderType === 'delivery' ? 'توصيل' : 'استلام'}</span>
        </CardTitle>
        <CardDescription>
          {statusLabel(order.status, order.orderType)} · {formatCairoDateTime(order.createdAt)} · منذ {minutes} دقيقة
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1 text-sm">
        <p>
          <span className="font-semibold">{order.customerName}</span> ·{' '}
          <a href={`tel:${order.phone}`} dir="ltr" className="underline">
            {order.phone}
          </a>
        </p>
        {order.orderType === 'delivery' ? (
          <p>
            {order.zoneLabel} · {order.street} · عمارة {order.building}
          </p>
        ) : null}
        <p>{order.lines.reduce((n, l) => n + l.qty, 0)} صنف · <span className="font-bold">{formatEGP(order.totals.total)} كاش</span></p>
        {order.status === 'cancelled' && order.cancelReason ? <p className="font-semibold text-red-700">سبب الإلغاء: {order.cancelReason}</p> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {next ? <Button onClick={onAdvance}>{`نقل إلى: ${statusLabel(next, order.orderType)}`}</Button> : null}
        <Button variant="outline" onClick={onOpen}>
          التفاصيل
        </Button>
        {order.status !== 'cancelled' ? (
          <Button variant="ghost" className="text-red-700" onClick={onCancel}>
            إلغاء
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}
