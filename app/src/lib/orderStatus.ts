import type { OrderType } from './pricing'

// The four statuses agreed with the owner. No extra statuses: for pickup orders the
// third status is only *labelled* "ready for pickup".
export type OrderStatus = 'new' | 'preparing' | 'out_for_delivery' | 'cancelled'

export const STATUS_FLOW: OrderStatus[] = ['new', 'preparing', 'out_for_delivery']

export function statusLabel(status: OrderStatus, orderType: OrderType): string {
  switch (status) {
    case 'new':
      return 'طلب جديد'
    case 'preparing':
      return 'تم استلام طلبك وجاري التجهيز'
    case 'out_for_delivery':
      return orderType === 'pickup' ? 'جاهز للاستلام' : 'خرج للتوصيل'
    case 'cancelled':
      return 'ملغي'
  }
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(status)
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === 'cancelled') return false
  if (to === 'cancelled') return true
  return nextStatus(from) === to
}

export const CANCEL_REASONS = [
  'العميل ألغى الطلب',
  'العميل لا يرد',
  'العنوان خارج نطاق التوصيل',
  'صنف غير متاح',
  'طلب مكرر أو وهمي',
  'سبب آخر',
] as const
