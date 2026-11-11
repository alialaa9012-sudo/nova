// Order totals. The database recomputes the same values; the browser only displays them.
export type TaxBase = 'items_only' | 'items_and_delivery'
export type OrderType = 'delivery' | 'pickup'

export interface Charges {
  service_percent: number
  tax_percent: number
  tax_base: TaxBase | null
}

export interface PricedLine {
  unitPrice: number
  qty: number
}

export interface Totals {
  subtotal: number
  deliveryFee: number
  service: number
  tax: number
  total: number
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export function computeTotals(
  lines: PricedLine[],
  orderType: OrderType,
  deliveryFee: number,
  charges: Charges,
): Totals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0))
  const fee = orderType === 'delivery' ? deliveryFee : 0
  const service = round2((subtotal * charges.service_percent) / 100)
  const taxable = subtotal + service + (charges.tax_base === 'items_and_delivery' ? fee : 0)
  const tax = round2((taxable * charges.tax_percent) / 100)
  return { subtotal, deliveryFee: fee, service, tax, total: round2(subtotal + fee + service + tax) }
}
