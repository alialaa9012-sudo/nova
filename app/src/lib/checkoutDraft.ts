// Keeps what the customer typed at checkout on this device, so a reload or an app switch on a
// low-memory phone does not wipe it. Cleared once the order is placed.
import { emptyCheckoutForm, type CheckoutForm } from './checkout'

const key = (branchId: string) => `km.checkoutDraft.v1.${branchId}`
const FIELDS = Object.keys(emptyCheckoutForm) as (keyof CheckoutForm)[]

export function loadDraft(branchId: string): CheckoutForm {
  try {
    const saved = JSON.parse(localStorage.getItem(key(branchId)) ?? 'null') as Partial<Record<keyof CheckoutForm, unknown>> | null
    if (!saved || typeof saved !== 'object') return emptyCheckoutForm
    const form = { ...emptyCheckoutForm }
    for (const f of FIELDS) {
      if (typeof saved[f] === 'string') (form[f] as string) = (saved[f] as string).slice(0, 500)
    }
    if (form.orderType !== 'delivery' && form.orderType !== 'pickup') form.orderType = emptyCheckoutForm.orderType
    return form
  } catch {
    return emptyCheckoutForm
  }
}

export function saveDraft(branchId: string, form: CheckoutForm) {
  try {
    localStorage.setItem(key(branchId), JSON.stringify(form))
  } catch {
    /* storage full or blocked: the form still works, it just is not remembered */
  }
}

export function clearDraft(branchId: string) {
  try {
    localStorage.removeItem(key(branchId))
  } catch {
    /* nothing to clear */
  }
}
