const KEY = 'km.lastOrder.v1'

/** Remembers the last order on this device so the customer can reopen its status page. */
export function rememberOrder(number: string, phone: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ number, phone }))
  } catch {
    /* storage unavailable */
  }
}

export function lastOrder(): { number: string; phone: string } | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { number?: string; phone?: string } | null
    return value?.number && value.phone ? { number: value.number, phone: value.phone } : null
  } catch {
    return null
  }
}
