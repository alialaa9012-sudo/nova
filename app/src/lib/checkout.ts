import { normalizeEgyptianMobile } from './phone'
import type { OrderType } from './pricing'

export interface CheckoutForm {
  orderType: OrderType
  name: string
  phone: string
  zoneId: string
  street: string
  building: string
  apartment: string
  landmark: string
  notes: string
}

export type CheckoutErrors = Partial<Record<keyof CheckoutForm, string>>

export const emptyCheckoutForm: CheckoutForm = {
  orderType: 'delivery',
  name: '',
  phone: '',
  zoneId: '',
  street: '',
  building: '',
  apartment: '',
  landmark: '',
  notes: '',
}

export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {}
  const name = form.name.trim()
  if (name.length < 2) errors.name = 'اكتب الاسم.'
  else if (name.length > 80) errors.name = 'الاسم طويل جداً.'
  if (!normalizeEgyptianMobile(form.phone)) errors.phone = 'اكتب رقم موبايل صحيح من 11 رقماً يبدأ بـ 01.'
  if (form.orderType === 'delivery') {
    if (!form.zoneId) errors.zoneId = 'اختر المنطقة.'
    if (!form.street.trim()) errors.street = 'اكتب اسم الشارع.'
    if (!form.building.trim()) errors.building = 'اكتب رقم العمارة.'
  }
  if (form.notes.length > 500) errors.notes = 'الملاحظات أطول من 500 حرف.'
  return errors
}
