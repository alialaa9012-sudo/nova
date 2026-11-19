import type { SupabaseClient } from '@supabase/supabase-js'
import { getMenu } from '../catalog'
import { createSupabaseApi } from './supabase'
import { ApiError } from './types'

type Reply = { data: unknown; error: { message?: string; code?: string } | null }

/** A stand-in for the Supabase client: each table or function answers with a prepared reply. */
function fake(replies: { tables?: Record<string, Reply | Reply[]>; rpc?: Record<string, Reply>; user?: { id: string; email: string } | null }) {
  const calls: { kind: string; name: string; args?: unknown }[] = []
  const next = (key: string): Reply => {
    const r = replies.tables?.[key]
    if (Array.isArray(r)) return r.length > 1 ? r.shift()! : r[0]
    return r ?? { data: [], error: null }
  }
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'maybeSingle', 'single']) b[m] = () => b
    for (const m of ['eq', 'gt']) b[m] = (column: string, value: unknown) => (calls.push({ kind: m, name: table, args: [column, value] }), b)
    for (const m of ['insert', 'update', 'delete']) b[m] = (args: unknown) => (calls.push({ kind: m, name: table, args }), b)
    b.then = (resolve: (r: Reply) => unknown) => resolve(next(table))
    return b
  }
  let signedOut = false
  const listeners: { table: string; cb: (payload: unknown) => void }[] = []
  const statusListeners: ((status: string) => void)[] = []
  const client = {
    from: (table: string) => builder(table),
    rpc: (name: string, args: unknown) => {
      calls.push({ kind: 'rpc', name, args })
      return Promise.resolve(replies.rpc?.[name] ?? { data: null, error: null })
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: replies.user ? { user: replies.user } : null } }),
      signInWithPassword: () =>
        Promise.resolve(replies.user ? { data: { user: replies.user }, error: null } : { data: { user: null }, error: { status: 400, message: 'bad' } }),
      signOut: () => ((signedOut = true), Promise.resolve({ error: null })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    channel: () => ({
      on(_kind: string, filter: { table?: string }, cb: (payload: unknown) => void) { listeners.push({ table: filter.table ?? _kind, cb }); return this },
      subscribe(cb?: (status: string) => void) { if (cb) statusListeners.push(cb); return this },
    }),
    removeChannel: () => Promise.resolve('ok'),
  }
  const push = (table: string, payload: unknown) => listeners.filter((l) => l.table === table).forEach((l) => l.cb(payload))
  const status = (s: string) => statusListeners.forEach((cb) => cb(s))
  const tables = () => listeners.map((l) => l.table)
  return { client: client as unknown as SupabaseClient, calls, wasSignedOut: () => signedOut, push, status, tables }
}

const item = getMenu('ashry').flatMap((c) => c.items).find((i) => i.name === 'صدور فراخ')!
const size = item.sizes.find((s) => s.label === 'ربع')!
const sizeRow = { id: 77, label: 'ربع', menu_items: { name_ar: 'صدور فراخ', branch_id: 'ashry', menu_categories: { name_ar: item.category } } }
const tracked = {
  order_number: 'A-0001', order_date: '2027-01-04', branch_id: 'ashry', order_type: 'pickup', status: 'new',
  created_at: '2027-01-04T10:00:00Z', subtotal: 250, delivery_fee: 0, tax_amount: 0, total: 250,
  items: [{ name: 'صدور فراخ', size: 'ربع', qty: 1, line_total: 250, note: null }],
  history: [{ status: 'new', at: '2027-01-04T10:00:00Z' }],
}
const pickup = { branchId: 'ashry' as const, orderType: 'pickup' as const, customerName: ' أحمد ', phone: '٠١٠١٢٣٤٥٦٧٨', lines: [{ sizeId: size.id, qty: 1, note: ' بدون  ملح ' }] }

describe('Supabase backend', () => {
  it('sends the database ids and returns the order the database stored', async () => {
    const { client, calls } = fake({
      tables: { menu_item_sizes: { data: [sizeRow], error: null } },
      rpc: { place_order: { data: { order_id: 'uuid-1', order_number: 'A-0001' }, error: null }, track_order: { data: tracked, error: null } },
    })
    const order = await createSupabaseApi(client).placeOrder({ ...pickup, clientRef: '11111111-1111-4111-8111-111111111111' })
    const sent = (calls.find((c) => c.name === 'place_order')!.args as { p: Record<string, unknown> }).p
    expect(sent).toMatchObject({
      branch_id: 'ashry', order_type: 'pickup', phone: '01012345678',
      client_ref: '11111111-1111-4111-8111-111111111111', items: [{ size_id: 77, qty: 1, note: 'بدون ملح' }],
    })
    expect(order).toMatchObject({ id: 'uuid-1', number: 'A-0001', status: 'new', customerName: 'أحمد', totals: { total: 250 } })
    expect(order.lines[0]).toMatchObject({ name: 'صدور فراخ', unitPrice: 250, qty: 1 })
  })

  it('turns a database error code into an ApiError', async () => {
    const { client } = fake({
      tables: { menu_item_sizes: { data: [sizeRow], error: null } },
      rpc: { place_order: { data: null, error: { message: 'BRANCH_CLOSED', code: 'P0001' } } },
    })
    await expect(createSupabaseApi(client).placeOrder(pickup)).rejects.toMatchObject({ code: 'BRANCH_CLOSED' })
  })

  it('refuses a line the database does not know', async () => {
    const { client } = fake({ tables: { menu_item_sizes: { data: [], error: null } } })
    await expect(createSupabaseApi(client).placeOrder(pickup)).rejects.toMatchObject({ code: 'ITEM_UNAVAILABLE' })
  })

  it('reports a lost connection instead of a database code', async () => {
    const { client } = fake({ tables: { menu_item_sizes: { data: null, error: { message: 'Failed to fetch' } } } })
    await expect(createSupabaseApi(client).placeOrder(pickup)).rejects.toMatchObject({ code: 'NETWORK' })
  })

  it('finds no order for a wrong phone number or a malformed one', async () => {
    const { client } = fake({ rpc: { track_order: { data: null, error: null } } })
    const api = createSupabaseApi(client)
    expect(await api.trackOrder('A-0001', '01012345678')).toBeNull()
    expect(await api.trackOrder('A-0001', '123')).toBeNull()
  })

  it('reads staff orders with lines, notes and history in order', async () => {
    const row = {
      id: 'uuid-1', order_number: 'A-0001', order_date: '2027-01-04', branch_id: 'ashry', order_type: 'delivery', status: 'preparing',
      customer_name: 'أحمد', phone: '01012345678', zone_label: 'مجاورة 1', street: 'ش 1', building: '2', subtotal: '250.00',
      delivery_fee: '20.00', service_amount: '0', tax_amount: '0', total: '270.00', created_at: '2027-01-04T10:00:00Z',
      order_items: [{ id: 2, name_snapshot: 'ب', size_label_snapshot: '', unit_price: 10, qty: 1, line_total: 10, note: null }, { id: 1, name_snapshot: 'أ', size_label_snapshot: 'ربع', unit_price: 240, qty: 1, line_total: 240, note: 'حار' }],
      order_status_history: [{ id: 2, from_status: 'new', to_status: 'preparing', changed_at: '2027-01-04T10:05:00Z', note: null }, { id: 1, from_status: null, to_status: 'new', changed_at: '2027-01-04T10:00:00Z', note: null }],
    }
    const { client } = fake({ tables: { orders: { data: [row], error: null } } })
    const [order] = await createSupabaseApi(client).listOrders()
    expect(order.lines.map((l) => l.name)).toEqual(['أ', 'ب'])
    expect(order.lines[0].note).toBe('حار')
    expect(order.totals).toEqual({ subtotal: 250, deliveryFee: 20, service: 0, tax: 0, total: 270 })
    expect(order.history.map((h) => h.to)).toEqual(['new', 'preparing'])
  })

  it('changes the status through the database function and re-reads the order', async () => {
    const row = { id: 'uuid-1', order_number: 'A-0001', order_date: '2027-01-04', branch_id: 'ashry', order_type: 'pickup', status: 'preparing', customer_name: 'أحمد', phone: '01012345678', subtotal: 1, total: 1, created_at: 'x', order_items: [], order_status_history: [] }
    const { client, calls } = fake({ tables: { orders: { data: row, error: null } }, rpc: { set_order_status: { data: null, error: null } } })
    const order = await createSupabaseApi(client).setStatus('uuid-1', 'preparing')
    expect(calls.find((c) => c.name === 'set_order_status')!.args).toEqual({ p_order_id: 'uuid-1', p_status: 'preparing', p_note: null })
    expect(order.status).toBe('preparing')
  })

  it('loads one day of orders for the board, and a single order by id', async () => {
    const { client, calls } = fake({ tables: { orders: [{ data: [], error: null }, { data: null, error: null }] } })
    const api = createSupabaseApi(client)
    await api.listOrders({ date: '2027-01-04' })
    expect(calls).toContainEqual({ kind: 'eq', name: 'orders', args: ['order_date', '2027-01-04'] })
    expect(calls.some((c) => c.kind === 'gt')).toBe(false)
    expect(await api.getOrder('missing')).toBeNull()
  })

  it('asks only for orders changed after a given time', async () => {
    const { client, calls } = fake({ tables: { orders: { data: [{ id: 'u1', order_number: 'A-0001', order_date: '2027-01-04', created_at: '2027-01-04T10:00:00Z', updated_at: '2027-01-04T10:05:00Z' }], error: null } } })
    const [order] = await createSupabaseApi(client).listOrders({ date: '2027-01-04', since: '2027-01-04T10:01:00Z' })
    expect(calls).toContainEqual({ kind: 'gt', name: 'orders', args: ['updated_at', '2027-01-04T10:01:00Z'] })
    expect(order.updatedAt).toBe('2027-01-04T10:05:00Z')
  })

  it('listens to orders only, and re-reads when the live connection comes back or fails', () => {
    const { client, status, tables } = fake({})
    const seen: unknown[] = []
    const stop = createSupabaseApi(client).subscribe((change) => seen.push(change), { pollMs: 0 })
    // delivery_zones is not published for Realtime; asking for it got the whole channel refused.
    expect(tables().filter((t) => t !== 'system')).toEqual(['orders'])
    status('SUBSCRIBED')
    expect(seen).toEqual([])
    status('CHANNEL_ERROR')
    status('SUBSCRIBED')
    expect(seen).toEqual([undefined, undefined])
    stop()
  })

  it('names the changed order in a push and does not poll when asked not to', async () => {
    vi.useFakeTimers()
    try {
      const { client, push } = fake({})
      const seen: unknown[] = []
      const stop = createSupabaseApi(client).subscribe((change) => seen.push(change), { pollMs: 0 })
      push('orders', { new: { id: 'uuid-9' }, old: {} })
      vi.advanceTimersByTime(60_000)
      expect(seen).toEqual([{ orderId: 'uuid-9' }])
      stop()
      const polled: unknown[] = []
      const stop2 = createSupabaseApi(client).subscribe((change) => polled.push(change), { pollMs: 15_000 })
      vi.advanceTimersByTime(30_000)
      expect(polled).toHaveLength(2)
      stop2()
    } finally {
      vi.useRealTimers()
    }
  })

  describe('zones', () => {
    const zone = (over: Record<string, unknown>) => ({ id: 5, zone_type: 'منطقة', name_ar: 'اللوتس', fee: 75, review_status: 'ok', is_active: true, note: '', ...over })

    it('rejects a zone that is already offered', async () => {
      const { client } = fake({ tables: { delivery_zones: { data: [zone({ name_ar: 'القاهرة' })], error: null } } })
      await expect(createSupabaseApi(client).addZone('ashry', { name: 'القاهره', fee: 50 })).rejects.toMatchObject({ code: 'ZONE_EXISTS' })
    })

    it('prices a pending zone instead of adding a duplicate', async () => {
      const pending = zone({ id: 9, name_ar: 'الشروق', is_active: false, review_status: 'pending' })
      const { client, calls } = fake({ tables: { delivery_zones: [{ data: [pending], error: null }, { data: { ...pending, fee: 300, is_active: true, note: 'admin' }, error: null }] } })
      const added = await createSupabaseApi(client).addZone('ashry', { name: 'الشروق', fee: 300 })
      expect(calls.some((c) => c.kind === 'insert')).toBe(false)
      expect(calls.find((c) => c.kind === 'update')!.args).toMatchObject({ fee: 300, fee_max: 300, is_active: true })
      expect(added).toMatchObject({ id: '9', fee: 300, custom: true })
    })

    it('validates the name and the fee before sending anything', async () => {
      const { client, calls } = fake({ tables: { delivery_zones: { data: [], error: null } } })
      const api = createSupabaseApi(client)
      await expect(api.addZone('ashry', { name: ' ', fee: 10 })).rejects.toMatchObject({ code: 'INVALID_ZONE_NAME' })
      await expect(api.addZone('ashry', { name: 'سس', fee: 10.5 })).rejects.toMatchObject({ code: 'INVALID_ZONE_FEE' })
      expect(calls.some((c) => c.kind === 'insert' || c.kind === 'update')).toBe(false)
    })

    it('only removes zones that were added from the admin screen', async () => {
      const { client } = fake({ tables: { delivery_zones: { data: { id: 5, note: '' }, error: null } } })
      await expect(createSupabaseApi(client).removeZone('5')).rejects.toMatchObject({ code: 'ZONE_NOT_REMOVABLE' })
    })
  })

  describe('staff sign-in', () => {
    it('lets an active staff member in', async () => {
      const { client } = fake({ user: { id: 'u1', email: 'a@b.c' }, tables: { staff_profiles: { data: { is_active: true }, error: null } } })
      await expect(createSupabaseApi(client).auth!.signIn('a@b.c', 'pw')).resolves.toBeUndefined()
    })

    it('signs out an account that is not staff', async () => {
      const { client, wasSignedOut } = fake({ user: { id: 'u2', email: 'x@y.z' }, tables: { staff_profiles: { data: null, error: null } } })
      await expect(createSupabaseApi(client).auth!.signIn('x@y.z', 'pw')).rejects.toMatchObject({ code: 'NOT_ALLOWED' })
      expect(wasSignedOut()).toBe(true)
    })

    it('reports a wrong password', async () => {
      const { client } = fake({ user: null })
      await expect(createSupabaseApi(client).auth!.signIn('a@b.c', 'bad')).rejects.toBeInstanceOf(ApiError)
    })

    it('has no session without a signed-in user', async () => {
      const { client } = fake({ user: null })
      expect(await createSupabaseApi(client).auth!.getSession()).toBeNull()
    })
  })
})
