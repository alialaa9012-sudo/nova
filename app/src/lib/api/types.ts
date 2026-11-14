import type { BranchId, DeliveryZone } from '../catalog'
import type { OrderStatus } from '../orderStatus'
import type { OrderType, Totals } from '../pricing'

export interface PlaceOrderInput {
  branchId: BranchId
  orderType: OrderType
  customerName: string
  phone: string
  zoneId?: string
  street?: string
  building?: string
  apartment?: string
  landmark?: string
  notes?: string
  lines: { sizeId: string; qty: number }[]
}

export interface NewZoneInput {
  /** One of the branch's own zone types (e.g. "مجاورة" at Ashry). Defaults to a plain area. */
  type?: string
  name: string
  /** Delivery fee in whole pounds. */
  fee: number
}

export interface OrderLine {
  name: string
  sizeLabel: string
  unitPrice: number
  qty: number
  lineTotal: number
}

export interface StatusEvent {
  from: OrderStatus | null
  to: OrderStatus
  at: string
  note?: string
}

export interface Order {
  id: string
  number: string
  date: string
  branchId: BranchId
  orderType: OrderType
  status: OrderStatus
  customerName: string
  phone: string
  zoneLabel?: string
  street?: string
  building?: string
  apartment?: string
  landmark?: string
  notes?: string
  lines: OrderLine[]
  totals: Totals
  cancelReason?: string
  posInvoiceNo?: string
  createdAt: string
  history: StatusEvent[]
}

/** Same error codes as the database functions (e.g. BRANCH_CLOSED). */
export class ApiError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'ApiError'
  }
}

export interface OrdersApi {
  /** "local" keeps orders in this browser only (demo); "supabase" is the live backend. */
  readonly mode: 'local' | 'supabase'
  placeOrder(input: PlaceOrderInput): Promise<Order>
  trackOrder(number: string, phone: string): Promise<Order | null>
  listOrders(): Promise<Order[]>
  setStatus(orderId: string, status: OrderStatus, note?: string): Promise<Order>
  setPosInvoice(orderId: string, value: string): Promise<Order>
  /** Zones a customer of this branch can choose, including zones added by the admin. */
  listZones(branchId: BranchId): Promise<DeliveryZone[]>
  addZone(branchId: BranchId, input: NewZoneInput): Promise<DeliveryZone>
  /** Removes a zone that was added through addZone. Placed orders keep their own copy. */
  removeZone(zoneId: string): Promise<void>
  /** Called when orders or zones change. */
  subscribe(onChange: () => void): () => void
}
