import type { Order } from './api/types'
import { getBranch } from './catalog'
import { formatEGP } from './format'

/** Plain-text order summary for copying into the cashier system. */
export function orderText(order: Order): string {
  const branch = getBranch(order.branchId)
  const out = [
    `طلب ${order.number} | فرع ${branch?.name ?? order.branchId}`,
    `النوع: ${order.orderType === 'delivery' ? 'توصيل' : 'استلام من الفرع'}`,
    `العميل: ${order.customerName} | ${order.phone}`,
  ]
  if (order.orderType === 'delivery') {
    const address = [
      order.zoneLabel,
      order.street,
      order.building && `عمارة ${order.building}`,
      order.apartment && `شقة ${order.apartment}`,
      order.landmark && `علامة مميزة: ${order.landmark}`,
    ].filter(Boolean)
    out.push(`العنوان: ${address.join('، ')}`)
  }
  out.push('الأصناف:')
  for (const l of order.lines) {
    out.push(`- ${l.qty} × ${l.name}${l.sizeLabel ? ` (${l.sizeLabel})` : ''} = ${formatEGP(l.lineTotal)}`)
  }
  out.push(`المجموع: ${formatEGP(order.totals.subtotal)}`)
  if (order.orderType === 'delivery') out.push(`التوصيل: ${formatEGP(order.totals.deliveryFee)}`)
  if (order.totals.service > 0) out.push(`الخدمة: ${formatEGP(order.totals.service)}`)
  if (order.totals.tax > 0) out.push(`الضريبة: ${formatEGP(order.totals.tax)}`)
  out.push(`الإجمالي: ${formatEGP(order.totals.total)} (كاش)`)
  if (order.notes) out.push(`ملاحظات: ${order.notes}`)
  return out.join('\n')
}
