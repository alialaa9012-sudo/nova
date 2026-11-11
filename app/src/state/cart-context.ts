import { createContext, useContext, type Dispatch } from 'react'
import type { CartAction, CartLine } from '@/lib/cart'
import { findSize } from '@/lib/catalog'

export interface CartState {
  branchId: string
  lines: CartLine[]
  dispatch: Dispatch<CartAction>
}

export const CartContext = createContext<CartState | null>(null)

export function useCart(): CartState {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used inside CartProvider')
  return cart
}

const key = (branchId: string) => `km.cart.v1.${branchId}`

/** Loads a saved cart and drops lines that no longer exist, refreshing prices from the catalog. */
export function loadCart(branchId: string): CartLine[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key(branchId)) ?? '[]') as CartLine[]
    if (!Array.isArray(saved)) return []
    return saved.flatMap((line) => {
      const found = findSize(branchId, line.sizeId)
      if (!found || found.item.advanceNoticeHours) return []
      return [{ ...line, name: found.item.name, sizeLabel: found.size.label, unitPrice: found.size.price }]
    })
  } catch {
    return []
  }
}

export function saveCart(branchId: string, lines: CartLine[]): void {
  try {
    localStorage.setItem(key(branchId), JSON.stringify(lines))
  } catch {
    /* storage unavailable (private mode): the cart lives in memory only */
  }
}
