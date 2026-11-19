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
  /**
   * A random id made once per checkout. Sending the same request again (a double tap, or a retry
   * after a lost response) returns the order already placed instead of placing a second one.
   */
  clientRef?: string
  /** note: the customer's note on that item, at most 120 characters. */
  lines: { sizeId: string; qty: number; note?: string }[]
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
  /** The customer's note on this item, if any. */
  note?: string
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
  /** The checkout's clientRef, kept so a repeated request finds this order. */
  clientRef?: string
  createdAt: string
  /** Set on acceptance: earliest time to promise, and when the order moves on by itself. */
  readyFrom?: string
  readyBy?: string
  /** Last change to the order (status, invoice). Older demo orders have none. */
  updatedAt?: string
  history: StatusEvent[]
}

/** How far a visitor got: opened the site, a menu, added to the cart, opened checkout, ordered. */
export type VisitStep = 'home' | 'menu' | 'cart' | 'checkout' | 'ordered'
export const VISIT_STEPS: VisitStep[] = ['home', 'menu', 'cart', 'checkout', 'ordered']

/** One day's visitors, and how many stopped at each step (the furthest each one reached). */
export type VisitFunnel = { visitors: number } & Record<VisitStep, number>

/** Same error codes as the database functions (e.g. BRANCH_CLOSED). */
export class ApiError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'ApiError'
  }
}

/** Staff sign-in, present only on the live backend. */
export interface AuthApi {
  /** The signed-in staff member, or null. */
  getSession(): Promise<{ email: string } | null>
  /** Throws ApiError INVALID_LOGIN for a wrong email or password, NOT_ALLOWED for a non-staff account. */
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  /** Called when staff sign in or out (also from another tab). */
  onChange(callback: (session: { email: string } | null) => void): () => void
}

export interface OrdersApi {
  /** "local" keeps orders in this browser only (demo); "supabase" is the live backend. */
  readonly mode: 'local' | 'supabase'
  /** Staff sign-in. Missing on the local demo, where the board is open. */
  readonly auth?: AuthApi
  placeOrder(input: PlaceOrderInput): Promise<Order>
  /**
   * A customer's order by number, by phone, or both. Phone: the latest order of the last 3 days.
   * Number alone: today's order with that number.
   */
  trackOrder(number: string | null, phone: string | null): Promise<Order | null>
  /**
   * Staff: orders of one Cairo date (YYYY-MM-DD), or the latest 1000 without a date. With `since`
   * (an ISO time) only the orders created or changed after it, so a board can poll cheaply.
   */
  listOrders(options?: { date?: string; since?: string }): Promise<Order[]>
  /** Staff: one order, or null when it no longer exists. */
  getOrder(orderId: string): Promise<Order | null>
  setStatus(orderId: string, status: OrderStatus, note?: string): Promise<Order>
  setPosInvoice(orderId: string, value: string): Promise<Order>
  /** Records a step of an anonymous visit (a random id per browser and day); repeats are ignored. */
  logVisit(visitId: string, step: VisitStep, branchId?: BranchId): Promise<void>
  /** Staff: one day's visitors and where they stopped; with a branch, those who opened its menu. */
  visitFunnel(options: { date: string; branchId?: BranchId }): Promise<VisitFunnel>
  /** Moves every order whose preparation time is up (the database also does this each minute). */
  advanceDueOrders(): Promise<void>
  /** Zones a customer of this branch can choose, including zones added by the admin. */
  listZones(branchId: BranchId): Promise<DeliveryZone[]>
  addZone(branchId: BranchId, input: NewZoneInput): Promise<DeliveryZone>
  /** Removes a zone that was added through addZone. Placed orders keep their own copy. */
  removeZone(zoneId: string): Promise<void>
  /**
   * Calls onChange when orders or zones change. When the backend knows which order changed it passes
   * its id, so a screen can fetch just that order. A call without an id means "re-read": a timer tick,
   * or the live connection (re)starting or failing, when pushes may have been missed. pollMs is that
   * timer for screens that get no push (customers); 0 turns it off. The local demo ignores it.
   */
  subscribe(onChange: (change?: { orderId?: string }) => void, options?: { pollMs?: number }): () => void
}
