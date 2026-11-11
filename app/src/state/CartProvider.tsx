import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { cartReducer } from '@/lib/cart'
import { CartContext, loadCart, saveCart } from './cart-context'

export function CartProvider({ branchId, children }: { branchId: string; children: ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, branchId, loadCart)
  useEffect(() => saveCart(branchId, lines), [branchId, lines])
  const value = useMemo(() => ({ branchId, lines, dispatch }), [branchId, lines])
  return <CartContext value={value}>{children}</CartContext>
}
