export interface CartLine {
  sizeId: string
  itemId: string
  name: string
  sizeLabel: string
  unitPrice: number
  qty: number
}

export const MAX_QTY = 50

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'qty'>; qty: number }
  | { type: 'setQty'; sizeId: string; qty: number }
  | { type: 'remove'; sizeId: string }
  | { type: 'clear' }

const clamp = (n: number) => Math.max(0, Math.min(MAX_QTY, Math.floor(n)))

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const qty = clamp(action.qty)
      if (qty === 0) return state
      const existing = state.find((l) => l.sizeId === action.line.sizeId)
      if (existing) {
        return state.map((l) => (l.sizeId === action.line.sizeId ? { ...l, qty: clamp(l.qty + qty) } : l))
      }
      return [...state, { ...action.line, qty }]
    }
    case 'setQty': {
      const qty = clamp(action.qty)
      if (qty === 0) return state.filter((l) => l.sizeId !== action.sizeId)
      return state.map((l) => (l.sizeId === action.sizeId ? { ...l, qty } : l))
    }
    case 'remove':
      return state.filter((l) => l.sizeId !== action.sizeId)
    case 'clear':
      return []
  }
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0)
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.unitPrice * l.qty, 0)
