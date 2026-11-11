// Demo backend: keeps orders in this browser only and applies the same rules as the
// database function place_order. Replaced by the Supabase backend in production.
import { findSize, findZone, getBranch } from '../catalog'
import { cairoDate } from '../format'
import { getOpenStatus } from '../hours'
import { canTransition, type OrderStatus } from '../orderStatus'
import { normalizeEgyptianMobile } from '../phone'
import { computeTotals, round2 } from '../pricing'
import { ApiError, type Order, type OrdersApi, type PlaceOrderInput } from './types'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const ORDERS_KEY = 'km.demo.orders.v1'
const CHANGE_EVENT = 'km:orders-changed'

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

export function browserStore(): KeyValueStore {
  try {
    const probe = '__km_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return memoryStore()
  }
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

const clean = (value: string | undefined, max: number) => {
  const v = (value ?? '').trim().slice(0, max)
  return v === '' ? undefined : v
}

export function createLocalApi(options: { store: KeyValueStore; now?: () => Date; events?: EventTarget }): OrdersApi {
  const { store } = options
  const now = options.now ?? (() => new Date())
  const events = options.events ?? new EventTarget()

  const read = (): Order[] => {
    try {
      return JSON.parse(store.getItem(ORDERS_KEY) ?? '[]') as Order[]
    } catch {
      return []
    }
  }
  const write = (orders: Order[]) => {
    store.setItem(ORDERS_KEY, JSON.stringify(orders))
    events.dispatchEvent(new Event(CHANGE_EVENT))
  }
  const update = (orderId: string, change: (o: Order) => Order): Order => {
    const orders = read()
    const i = orders.findIndex((o) => o.id === orderId)
    if (i < 0) throw new ApiError('ORDER_NOT_FOUND')
    orders[i] = change(orders[i])
    write(orders)
    return orders[i]
  }

  return {
    mode: 'local',

    async placeOrder(input: PlaceOrderInput) {
      const at = now()
      const branch = getBranch(input.branchId)
      if (!branch) throw new ApiError('BRANCH_NOT_FOUND')
      if (!getOpenStatus(branch.hours, at, branch.timezone).isOpen) throw new ApiError('BRANCH_CLOSED')
      if (input.orderType !== 'delivery' && input.orderType !== 'pickup') throw new ApiError('INVALID_ORDER_TYPE')
      const name = input.customerName.trim()
      if (name.length < 2 || name.length > 80) throw new ApiError('INVALID_NAME')
      const phone = normalizeEgyptianMobile(input.phone)
      if (!phone) throw new ApiError('INVALID_PHONE')

      const orders = read()
      const recent = orders.filter((o) => o.phone === phone && at.getTime() - Date.parse(o.createdAt) < 10 * 60_000)
      if (recent.length >= 3) throw new ApiError('TOO_MANY_ORDERS')

      let deliveryFee = 0
      let zoneLabel: string | undefined
      if (input.orderType === 'delivery') {
        const zone = input.zoneId ? findZone(branch.id, input.zoneId) : undefined
        if (!zone) throw new ApiError('INVALID_ZONE')
        if (!clean(input.street, 200) || !clean(input.building, 50)) throw new ApiError('ADDRESS_REQUIRED')
        deliveryFee = zone.fee
        zoneLabel = zone.label
      }

      if (input.lines.length === 0) throw new ApiError('EMPTY_CART')
      if (input.lines.length > 40) throw new ApiError('TOO_MANY_LINES')
      const lines = input.lines.map((line) => {
        if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 50) throw new ApiError('INVALID_QTY')
        const found = findSize(branch.id, line.sizeId)
        if (!found) throw new ApiError('ITEM_UNAVAILABLE')
        if (found.item.advanceNoticeHours) throw new ApiError('ADVANCE_BOOKING_REQUIRED')
        return {
          name: found.item.name,
          sizeLabel: found.size.label,
          unitPrice: found.size.price,
          qty: line.qty,
          lineTotal: round2(found.size.price * line.qty),
        }
      })

      const date = cairoDate(at)
      const seq = 1 + orders.filter((o) => o.branchId === branch.id && o.date === date).length
      const createdAt = at.toISOString()
      const order: Order = {
        id: newId(),
        number: `${branch.code}-${String(seq).padStart(4, '0')}`,
        date,
        branchId: branch.id,
        orderType: input.orderType,
        status: 'new',
        customerName: name,
        phone,
        zoneLabel,
        street: input.orderType === 'delivery' ? clean(input.street, 200) : undefined,
        building: input.orderType === 'delivery' ? clean(input.building, 50) : undefined,
        apartment: input.orderType === 'delivery' ? clean(input.apartment, 50) : undefined,
        landmark: input.orderType === 'delivery' ? clean(input.landmark, 200) : undefined,
        notes: clean(input.notes, 500),
        lines,
        totals: computeTotals(lines, input.orderType, deliveryFee, branch.charges),
        createdAt,
        history: [{ from: null, to: 'new', at: createdAt }],
      }
      write([...orders, order])
      return order
    },

    async trackOrder(number, phone) {
      const wanted = number.trim().toUpperCase()
      const normalized = normalizeEgyptianMobile(phone)
      const cutoff = now().getTime() - 3 * 24 * 60 * 60_000
      const matches = read()
        .filter((o) => o.number === wanted && o.phone === normalized && Date.parse(o.createdAt) > cutoff)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return matches[0] ?? null
    },

    async listOrders() {
      return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async setStatus(orderId: string, status: OrderStatus, note?: string) {
      const reason = note?.trim() || undefined
      return update(orderId, (o) => {
        if (!canTransition(o.status, status)) throw new ApiError('INVALID_TRANSITION')
        if (status === 'cancelled' && !reason) throw new ApiError('CANCEL_REASON_REQUIRED')
        return {
          ...o,
          status,
          cancelReason: status === 'cancelled' ? reason : o.cancelReason,
          history: [...o.history, { from: o.status, to: status, at: now().toISOString(), note: reason }],
        }
      })
    },

    async setPosInvoice(orderId, value) {
      return update(orderId, (o) => ({ ...o, posInvoiceNo: clean(value, 40) }))
    },

    subscribe(onChange) {
      const onStorage = (e: StorageEvent) => {
        if (e.key === ORDERS_KEY) onChange()
      }
      events.addEventListener(CHANGE_EVENT, onChange)
      if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
      return () => {
        events.removeEventListener(CHANGE_EVENT, onChange)
        if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
      }
    },
  }
}
