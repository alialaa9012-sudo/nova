import type { OrderType } from './pricing'

// The statuses agreed with the owner. For pickup orders the third status is only *labelled*
// "ready for pickup". «تم التسليم» (delivered) closes the order once the customer has it.
export type OrderStatus = 'new' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled'

export const STATUS_FLOW: OrderStatus[] = ['new', 'preparing', 'out_for_delivery', 'delivered']

/**
 * Minutes from acceptance until the order is ready, as {earliest, latest}. At the latest time the
 * order moves on by itself. Same numbers as prep_window() in the database.
 */
export const PREP_MINUTES: Record<OrderType, [number, number]> = { pickup: [30, 45], delivery: [45, 45] }

export function statusLabel(status: OrderStatus, orderType: OrderType): string {
  switch (status) {
    case 'new':
      return 'طلب جديد'
    case 'preparing':
      return 'تم استلام طلبك وجاري التجهيز'
    case 'out_for_delivery':
      return orderType === 'pickup' ? 'جاهز للاستلام' : 'خرج للتوصيل'
    case 'delivered':
      return 'تم التسليم'
    case 'cancelled':
      return 'ملغي'
  }
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(status)
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null
}

/** The staff button that moves an order to `next`. */
export function actionLabel(next: OrderStatus, orderType: OrderType): string {
  switch (next) {
    case 'preparing':
      return 'قبول الطلب'
    case 'out_for_delivery':
      return orderType === 'pickup' ? 'جاهز للاستلام الآن' : 'خرج للتوصيل الآن'
    case 'delivered':
      return 'تم التسليم'
    default:
      return statusLabel(next, orderType)
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === 'cancelled' || from === 'delivered') return false
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
