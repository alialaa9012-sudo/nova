export interface CartLine {
  sizeId: string
  itemId: string
  name: string
  sizeLabel: string
  unitPrice: number
  qty: number
  /** The customer's note on this item (e.g. «من غير شطة»). Same item and size with a different note is a separate line. */
  note?: string
}

export const MAX_QTY = 50
export const MAX_NOTE = 120

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'qty'>; qty: number }
  | { type: 'setQty'; key: string; qty: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' }

const clamp = (n: number) => Math.max(0, Math.min(MAX_QTY, Math.floor(n)))

/** Trimmed, single-spaced, at most MAX_NOTE characters; empty becomes undefined. */
export function cleanNote(note: string | undefined): string | undefined {
  const text = (note ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE).trim()
  return text || undefined
}

/** Identity of a cart line: the size plus the note. */
export const lineKey = (l: Pick<CartLine, 'sizeId' | 'note'>) => `${l.sizeId}|${l.note ?? ''}`

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const qty = clamp(action.qty)
      if (qty === 0) return state
      const line = { ...action.line, note: cleanNote(action.line.note) }
      const key = lineKey(line)
      if (state.some((l) => lineKey(l) === key)) {
        return state.map((l) => (lineKey(l) === key ? { ...l, qty: clamp(l.qty + qty) } : l))
      }
      return [...state, { ...line, qty }]
    }
    case 'setQty': {
      const qty = clamp(action.qty)
      if (qty === 0) return state.filter((l) => lineKey(l) !== action.key)
      return state.map((l) => (lineKey(l) === action.key ? { ...l, qty } : l))
    }
    case 'remove':
      return state.filter((l) => lineKey(l) !== action.key)
    case 'clear':
      return []
  }
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0)
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.unitPrice * l.qty, 0)
