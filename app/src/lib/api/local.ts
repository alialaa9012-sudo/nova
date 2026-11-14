// Demo backend: keeps orders in this browser only and applies the same rules as the
// database function place_order. Replaced by the Supabase backend in production.
import { branches, findSize, getBranch, getZones, type BranchId, type DeliveryZone } from '../catalog'
import { cairoDate } from '../format'
import { getOpenStatus } from '../hours'
import { canTransition, type OrderStatus } from '../orderStatus'
import { normalizeEgyptianMobile } from '../phone'
import { computeTotals, round2 } from '../pricing'
import { cleanZoneName, DEFAULT_ZONE_TYPE, MAX_ZONE_FEE, MAX_ZONE_NAME, zoneKey, zoneLabel } from '../zones'
import { ApiError, type NewZoneInput, type Order, type OrdersApi, type PlaceOrderInput } from './types'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const ORDERS_KEY = 'km.demo.orders.v1'
export const ZONES_KEY = 'km.demo.zones.v1'

/** A zone added from the admin screen, as kept in the store. */
interface StoredZone {
  id: string
  branchId: BranchId
  type: string
  name: string
  fee: number
  createdAt: string
}
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
  const readZones = (): StoredZone[] => {
    try {
      return JSON.parse(store.getItem(ZONES_KEY) ?? '[]') as StoredZone[]
    } catch {
      return []
    }
  }
  const writeZones = (zones: StoredZone[]) => {
    store.setItem(ZONES_KEY, JSON.stringify(zones))
    events.dispatchEvent(new Event(CHANGE_EVENT))
  }
  const toZone = (z: StoredZone): DeliveryZone => ({
    id: z.id,
    type: z.type,
    name: z.name,
    label: zoneLabel(z.type, z.name),
    fee: z.fee,
    needsReview: false,
    custom: true,
  })
  /** The branch's own list followed by the zones added from the admin screen. */
  const zonesOf = (branchId: string): DeliveryZone[] => [
    ...getZones(branchId),
    ...readZones()
      .filter((z) => z.branchId === branchId)
      .map(toZone),
  ]
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
        const zone = input.zoneId ? zonesOf(branch.id).find((z) => z.id === input.zoneId) : undefined
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

    async listZones(branchId) {
      return zonesOf(branchId)
    },

    async addZone(branchId, input: NewZoneInput) {
      const branch = getBranch(branchId)
      if (!branch) throw new ApiError('BRANCH_NOT_FOUND')
      const existing = zonesOf(branch.id)
      const type = input.type ?? DEFAULT_ZONE_TYPE
      if (type !== DEFAULT_ZONE_TYPE && !existing.some((z) => z.type === type)) throw new ApiError('INVALID_ZONE_TYPE')
      const name = cleanZoneName(input.name)
      const label = zoneLabel(type, name)
      if (name === '' || label.length < 2 || name.length > MAX_ZONE_NAME) throw new ApiError('INVALID_ZONE_NAME')
      if (!Number.isInteger(input.fee) || input.fee < 0 || input.fee > MAX_ZONE_FEE) throw new ApiError('INVALID_ZONE_FEE')
      const key = zoneKey(label)
      if (existing.some((z) => zoneKey(z.label) === key)) throw new ApiError('ZONE_EXISTS')

      const stored: StoredZone = {
        id: `${branch.id}-n-${newId()}`,
        branchId: branch.id,
        type,
        name,
        fee: input.fee,
        createdAt: now().toISOString(),
      }
      writeZones([...readZones(), stored])
      return toZone(stored)
    },

    async removeZone(zoneId) {
      const zones = readZones()
      if (!zones.some((z) => z.id === zoneId)) {
        const original = branches.some((b) => getZones(b.id).some((z) => z.id === zoneId))
        throw new ApiError(original ? 'ZONE_NOT_REMOVABLE' : 'ZONE_NOT_FOUND')
      }
      writeZones(zones.filter((z) => z.id !== zoneId))
    },

    subscribe(onChange) {
      const onStorage = (e: StorageEvent) => {
        if (e.key === ORDERS_KEY || e.key === ZONES_KEY) onChange()
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
