import { formatEGP } from '@/lib/format'
import type { OrderType, Totals } from '@/lib/pricing'
import { cn } from '@/lib/utils'

export interface SummaryLine {
  key: string
  name: string
  sizeLabel: string
  qty: number
  lineTotal: number
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', strong && 'pt-1 text-foreground')}>
      <dt className={cn(strong ? 'text-base font-bold' : 'text-muted-foreground')}>{label}</dt>
      <dd className={cn('tabular-nums', strong && 'text-lg leading-[26px] font-extrabold')}>{value}</dd>
    </div>
  )
}

export function OrderSummary({
  lines,
  totals,
  orderType,
  taxPercent,
  servicePercent,
  zonePending = false,
}: {
  lines: SummaryLine[]
  totals: Totals
  orderType: OrderType
  taxPercent: number
  servicePercent: number
  zonePending?: boolean
}) {
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-3 text-sm leading-5">
            <span>
              {l.qty} × {l.name}
              {l.sizeLabel ? ` (${l.sizeLabel})` : ''}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{formatEGP(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <hr className="border-brand-tint" />
      <dl className="grid gap-1.5 text-sm leading-5">
        <Row label="المجموع" value={formatEGP(totals.subtotal)} />
        {orderType === 'delivery' ? (
          <Row label="التوصيل" value={zonePending ? 'يُحدد بعد اختيار المنطقة' : formatEGP(totals.deliveryFee)} />
        ) : null}
        {totals.service > 0 ? <Row label={`خدمة ${servicePercent}٪`} value={formatEGP(totals.service)} /> : null}
        {totals.tax > 0 ? <Row label={`ضريبة ${taxPercent}٪`} value={formatEGP(totals.tax)} /> : null}
        <Row label={zonePending && orderType === 'delivery' ? 'الإجمالي بدون التوصيل' : 'الإجمالي'} value={formatEGP(totals.total)} strong />
      </dl>
    </div>
  )
}
