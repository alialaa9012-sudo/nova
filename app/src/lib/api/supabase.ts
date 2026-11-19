// Live backend: talks to the Supabase project through the database functions in
// supabase/migrations (place_order, track_order, set_order_status, set_pos_invoice) and plain
// table reads that row level security limits to staff. Prices and totals are decided in the
// database; this file only sends the request and reads the result.
import type { SupabaseClient } from '@supabase/supabase-js'
import { cleanNote } from '../cart'
import { findSize, getBranch, type BranchId, type DeliveryZone } from '../catalog'
import type { OrderStatus } from '../orderStatus'
import { cleanOrderNumber } from '../orderNumber'
import { normalizeEgyptianMobile, toAsciiDigits } from '../phone'
import { cleanZoneName, DEFAULT_ZONE_TYPE, MAX_ZONE_FEE, MAX_ZONE_NAME, zoneKey, zoneLabel } from '../zones'
import { ApiError, type AuthApi, type NewZoneInput, type Order, type OrdersApi, type PlaceOrderInput } from './types'

type Row = Record<string, unknown>

/** The stable code the database raises (e.g. BRANCH_CLOSED) is inside the error message. */
function toApiError(error: { message?: string; code?: string } | null | undefined): ApiError {
  const message = error?.message ?? ''
  const code = /\b[A-Z][A-Z_]{3,}\b/.exec(message)?.[0]
  if (code) return new ApiError(code)
  if (error?.code === '42501') return new ApiError('NOT_ALLOWED')
  return new ApiError('NETWORK')
}

function check<T>(result: { data: T | null; error: { message?: string; code?: string } | null }): T {
  if (result.error) throw toApiError(result.error)
  return result.data as T
}

const num = (v: unknown) => Number(v ?? 0)
const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined)

const ORDER_COLUMNS =
  '*, order_items(id, name_snapshot, size_label_snapshot, unit_price, qty, line_total, note), ' +
  'order_status_history(id, from_status, to_status, changed_at, note)'

/** A staff read of `orders` with its lines and history. */
function fromRow(r: Row): Order {
  const items = ((r.order_items as Row[]) ?? []).slice().sort((a, b) => num(a.id) - num(b.id))
  const history = ((r.order_status_history as Row[]) ?? [])
    .slice()
    .sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)) || num(a.id) - num(b.id))
  return {
    id: String(r.id),
    number: String(r.order_number),
    date: String(r.order_date),
    branchId: String(r.branch_id) as BranchId,
    orderType: r.order_type as Order['orderType'],
    status: r.status as OrderStatus,
    customerName: String(r.customer_name),
    phone: String(r.phone),
    zoneLabel: str(r.zone_label),
    street: str(r.street),
    building: str(r.building),
    apartment: str(r.apartment),
    landmark: str(r.landmark),
    notes: str(r.notes),
    lines: items.map((i) => ({
      name: String(i.name_snapshot),
      sizeLabel: String(i.size_label_snapshot ?? ''),
      unitPrice: num(i.unit_price),
      qty: num(i.qty),
      lineTotal: num(i.line_total),
      note: str(i.note),
    })),
    totals: {
      subtotal: num(r.subtotal),
      deliveryFee: num(r.delivery_fee),
      service: num(r.service_amount),
      tax: num(r.tax_amount),
      total: num(r.total),
    },
    cancelReason: str(r.cancel_reason),
    posInvoiceNo: str(r.pos_invoice_no),
    clientRef: str(r.client_ref),
    createdAt: String(r.created_at),
    readyFrom: str(r.ready_from),
    readyBy: str(r.ready_by),
    updatedAt: str(r.updated_at),
    history: history.map((h) => ({
      from: (h.from_status as OrderStatus | null) ?? null,
      to: h.to_status as OrderStatus,
      at: String(h.changed_at),
      note: str(h.note),
    })),
  }
}

/** What the customer sees from track_order (no phone or address, and no row id). */
function fromTracked(t: Row, phone: string): Order {
  const items = (t.items as Row[]) ?? []
  const history = (t.history as Row[]) ?? []
  return {
    id: `${t.order_date}-${t.order_number}`,
    number: String(t.order_number),
    date: String(t.order_date),
    branchId: String(t.branch_id) as BranchId,
    orderType: t.order_type as Order['orderType'],
    status: t.status as OrderStatus,
    customerName: '',
    phone,
    lines: items.map((i) => ({
      name: String(i.name),
      sizeLabel: String(i.size ?? ''),
      unitPrice: num(i.qty) > 0 ? Math.round((num(i.line_total) / num(i.qty)) * 100) / 100 : 0,
      qty: num(i.qty),
      lineTotal: num(i.line_total),
      note: str(i.note),
    })),
    totals: {
      subtotal: num(t.subtotal),
      deliveryFee: num(t.delivery_fee),
      service: Math.max(0, Math.round((num(t.total) - num(t.subtotal) - num(t.delivery_fee) - num(t.tax_amount)) * 100) / 100),
      tax: num(t.tax_amount),
      total: num(t.total),
    },
    createdAt: String(t.created_at),
    readyFrom: str(t.ready_from),
    readyBy: str(t.ready_by),
    history: history.map((h, i) => ({
      from: i === 0 ? null : (history[i - 1].status as OrderStatus),
      to: h.status as OrderStatus,
      at: String(h.at),
    })),
  }
}

const POLL_MS = 15_000

export function createSupabaseApi(client: SupabaseClient): OrdersApi {
  // The menu on screen comes from the app's files; the database has its own ids. A line is matched
  // by branch, category, item name and size label, which the seed copies from the same files.
  let sizeIds: Promise<Map<string, number>> | undefined
  const loadSizeIds = () => {
    sizeIds ??= (async () => {
      const rows = check(
        await client
          .from('menu_item_sizes')
          .select('id, label, menu_items!inner(name_ar, branch_id, menu_categories!inner(name_ar))'),
      ) as unknown as { id: number; label: string; menu_items: { name_ar: string; branch_id: string; menu_categories: { name_ar: string } } }[]
      return new Map(
        rows.map((r) => [
          `${r.menu_items.branch_id}|${r.menu_items.menu_categories.name_ar}|${r.menu_items.name_ar}|${r.label}`,
          r.id,
        ]),
      )
    })().catch((e) => {
      sizeIds = undefined
      throw e
    })
    return sizeIds
  }

  const toZone = (r: Row): DeliveryZone => ({
    id: String(r.id),
    type: String(r.zone_type),
    name: String(r.name_ar),
    label: zoneLabel(String(r.zone_type), String(r.name_ar)),
    fee: num(r.fee),
    needsReview: r.review_status === 'review',
    custom: r.note === 'admin',
  })
  const zoneRows = async (branchId: string, onlyActive: boolean): Promise<Row[]> => {
    let q = client.from('delivery_zones').select('*').eq('branch_id', branchId)
    if (onlyActive) q = q.eq('is_active', true)
    return check(await q.order('sort_order').order('id')) as unknown as Row[]
  }
  const fetchOrder = async (id: string): Promise<Order> => {
    const row = check(await client.from('orders').select(ORDER_COLUMNS).eq('id', id).maybeSingle())
    if (!row) throw new ApiError('ORDER_NOT_FOUND')
    return fromRow(row as Row)
  }

  const auth: AuthApi = {
    async getSession() {
      const { data } = await client.auth.getSession()
      const user = data.session?.user
      if (!user) return null
      const profile = await client.from('staff_profiles').select('is_active').eq('user_id', user.id).maybeSingle()
      return profile.data?.is_active ? { email: user.email ?? '' } : null
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error || !data.user) throw new ApiError(error?.status && error.status >= 500 ? 'NETWORK' : 'INVALID_LOGIN')
      const profile = await client.from('staff_profiles').select('is_active').eq('user_id', data.user.id).maybeSingle()
      if (!profile.data?.is_active) {
        await client.auth.signOut()
        throw new ApiError('NOT_ALLOWED')
      }
    },
    async signOut() {
      await client.auth.signOut()
    },
    onChange(callback) {
      const { data } = client.auth.onAuthStateChange(() => {
        void auth.getSession().then(callback)
      })
      return () => data.subscription.unsubscribe()
    },
  }

  return {
    mode: 'supabase',
    auth,

    async placeOrder(input: PlaceOrderInput) {
      const branch = getBranch(input.branchId)
      if (!branch) throw new ApiError('BRANCH_NOT_FOUND')
      const phone = normalizeEgyptianMobile(input.phone)
      if (!phone) throw new ApiError('INVALID_PHONE')
      const ids = await loadSizeIds()
      const items = input.lines.map((line) => {
        const found = findSize(branch.id, line.sizeId)
        const id = found ? ids.get(`${branch.id}|${found.item.category}|${found.item.name}|${found.size.label}`) : undefined
        if (id === undefined) throw new ApiError('ITEM_UNAVAILABLE')
        return { size_id: id, qty: line.qty, note: cleanNote(line.note) }
      })
      const placed = check(
        await client.rpc('place_order', {
          p: {
            branch_id: branch.id,
            order_type: input.orderType,
            customer_name: input.customerName,
            phone,
            zone_id: input.zoneId,
            street: input.street,
            building: input.building,
            apartment: input.apartment,
            landmark: input.landmark,
            notes: input.notes,
            client_ref: input.clientRef,
            items,
          },
        }),
      ) as Row
      const tracked = check(await client.rpc('track_order', { p_order_number: placed.order_number, p_phone: phone })) as Row | null
      if (!tracked) throw new ApiError('NETWORK')
      return {
        ...fromTracked(tracked, phone),
        id: String(placed.order_id),
        customerName: input.customerName.trim(),
        clientRef: input.clientRef,
      }
    },

    async trackOrder(number, phone) {
      const normalized = phone ? normalizeEgyptianMobile(phone) : null
      const wanted = number ? cleanOrderNumber(toAsciiDigits(number)) : null
      if ((phone && !normalized) || (!normalized && !wanted)) return null
      const tracked = check(await client.rpc('track_order', { p_order_number: wanted, p_phone: normalized })) as Row | null
      return tracked ? fromTracked(tracked, normalized ?? '') : null
    },

    async listOrders(options) {
      // One day at a time: the board never downloads the whole history.
      let q = client.from('orders').select(ORDER_COLUMNS)
      if (options?.date) q = q.eq('order_date', options.date)
      if (options?.since) q = q.gt('updated_at', options.since)
      const rows = check(await q.order('created_at', { ascending: false }).limit(1000)) as unknown as Row[]
      return rows.map(fromRow)
    },

    async getOrder(orderId) {
      const row = check(await client.from('orders').select(ORDER_COLUMNS).eq('id', orderId).maybeSingle())
      return row ? fromRow(row as unknown as Row) : null
    },

    async setStatus(orderId, status, note) {
      check(await client.rpc('set_order_status', { p_order_id: orderId, p_status: status, p_note: note?.trim() || null }))
      return fetchOrder(orderId)
    },

    async setPosInvoice(orderId, value) {
      check(await client.rpc('set_pos_invoice', { p_order_id: orderId, p_invoice: value }))
      return fetchOrder(orderId)
    },

    async logVisit(visitId, step, branchId) {
      check(await client.rpc('log_visit', { p_visit: visitId, p_step: step, p_branch: branchId ?? null }))
    },

    async visitFunnel({ date, branchId }) {
      const f = (check(await client.rpc('visit_funnel', { p_date: date, p_branch: branchId ?? null })) ?? {}) as Row
      return { visitors: num(f.visitors), home: num(f.home), menu: num(f.menu), cart: num(f.cart), checkout: num(f.checkout), ordered: num(f.ordered) }
    },

    async advanceDueOrders() {
      check(await client.rpc('advance_due_orders'))
    },

    async listZones(branchId) {
      return (await zoneRows(branchId, true)).map(toZone)
    },

    async addZone(branchId: BranchId, input: NewZoneInput) {
      if (!getBranch(branchId)) throw new ApiError('BRANCH_NOT_FOUND')
      const all = await zoneRows(branchId, false)
      const type = input.type ?? DEFAULT_ZONE_TYPE
      if (type !== DEFAULT_ZONE_TYPE && !all.some((z) => z.zone_type === type)) throw new ApiError('INVALID_ZONE_TYPE')
      const name = cleanZoneName(input.name)
      const label = zoneLabel(type, name)
      if (name === '' || label.length < 2 || name.length > MAX_ZONE_NAME) throw new ApiError('INVALID_ZONE_NAME')
      if (!Number.isInteger(input.fee) || input.fee < 0 || input.fee > MAX_ZONE_FEE) throw new ApiError('INVALID_ZONE_FEE')
      const key = zoneKey(label)
      const same = all.find((z) => zoneKey(zoneLabel(String(z.zone_type), String(z.name_ar))) === key)
      if (same?.is_active) throw new ApiError('ZONE_EXISTS')
      const values = { fee: input.fee, fee_max: input.fee, review_status: 'ok', is_active: true, note: 'admin' }
      // A zone that exists without a price (pending) is priced and switched on instead of duplicated.
      const row = same
        ? check(await client.from('delivery_zones').update(values).eq('id', same.id).select('*').single())
        : check(await client.from('delivery_zones').insert({ branch_id: branchId, zone_type: type, name_ar: name, ...values }).select('*').single())
      return toZone(row as unknown as Row)
    },

    async removeZone(zoneId) {
      const found = check(await client.from('delivery_zones').select('id, note').eq('id', zoneId).maybeSingle()) as unknown as Row | null
      if (!found) throw new ApiError('ZONE_NOT_FOUND')
      if (found.note !== 'admin') throw new ApiError('ZONE_NOT_REMOVABLE')
      check(await client.from('delivery_zones').delete().eq('id', zoneId))
    },

    subscribe(onChange, options) {
      // Staff get a push naming the order that changed, so the board fetches that order alone.
      // Customers cannot read orders and get no push, so their screens re-read on a timer instead.
      // Only `orders` is published for Realtime. A channel that also asks for an unpublished table is
      // refused as a whole (that silenced the board), so zones rely on the timer.
      let joinedBefore = false
      const channel = client
        .channel(`km-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Row | undefined
          onChange(row?.id ? { orderId: String(row.id) } : undefined)
        })
        .on('system', {}, (message: { status?: string; message?: string }) => {
          if (message?.status === 'error') console.warn('Realtime:', message.message)
        })
        .subscribe((status) => {
          // After a drop the client rejoins by itself; changes made meanwhile were never pushed.
          if (status === 'SUBSCRIBED') {
            if (joinedBefore) onChange()
            joinedBefore = true
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onChange()
        })
      const ms = options?.pollMs ?? POLL_MS
      const timer = ms > 0 ? setInterval(() => onChange(), ms) : undefined
      return () => {
        if (timer) clearInterval(timer)
        void client.removeChannel(channel)
      }
    },
  }
}
