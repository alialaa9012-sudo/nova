// «اطلب مرة أخرى»: turns a past order back into cart lines at today's prices.
import type { Order } from './api/types'
import type { CartLine } from './cart'
import { getMenu, type BranchId } from './catalog'

/** Cart lines for the items of `order` that the branch still sells, and the names it no longer does. */
export function reorderLines(branchId: BranchId, order: Pick<Order, 'lines'>): { lines: CartLine[]; missing: string[] } {
  const items = getMenu(branchId).flatMap((c) => c.items)
  const lines: CartLine[] = []
  const missing: string[] = []
  for (const l of order.lines) {
    const item = items.find((i) => i.name === l.name && !i.advanceNoticeHours)
    const size = item?.sizes.find((s) => s.label === l.sizeLabel)
    if (!item || !size) {
      missing.push(l.name)
      continue
    }
    lines.push({ sizeId: size.id, itemId: item.id, name: item.name, sizeLabel: size.label, unitPrice: size.price, qty: l.qty, note: l.note })
  }
  return { lines, missing }
}
