// @vitest-environment node
// Runs the real Supabase migration and seed on PGlite (PostgreSQL compiled to WebAssembly).
import { PGlite } from '@electric-sql/pglite'
import { branches, getMenu, getZones } from '@/lib/catalog'

const files = import.meta.glob<string>(
  ['../../supabase/migrations/*.sql', '../../supabase/seed.sql', '../../supabase/tests/supabase_stubs.sql'],
  { query: '?raw', import: 'default', eager: true },
)
const file = (suffix: string): string => {
  const hit = Object.entries(files).find(([path]) => path.endsWith(suffix))
  if (!hit) throw new Error(`missing ${suffix}`)
  return hit[1]
}
const migrations = Object.entries(files)
  .filter(([path]) => path.includes('/migrations/'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, sql]) => sql)

const STAFF = '11111111-1111-4111-8111-111111111111' // central call center, all branches
const ASHRY_AGENT = '22222222-2222-4222-8222-222222222222' // limited to the Ashry branch
const ADMIN = '33333333-3333-4333-8333-333333333333'

interface Placed {
  order_id: string
  order_number: string
  order_date: string
  subtotal: number
  delivery_fee: number
  service_amount: number
  tax_amount: number
  total: number
}
interface Tracked {
  status: string
  order_type: string
  total: number
  history: { status: string; at: string }[]
  items: { name: string; size: string; qty: number }[]
}

let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(file('supabase_stubs.sql'))
  for (const sql of migrations) await db.exec(sql)
  await db.exec(file('seed.sql'))
  await db.exec(`
    insert into auth.users (id) values ('${STAFF}'), ('${ASHRY_AGENT}'), ('${ADMIN}');
    insert into public.staff_profiles (user_id, full_name, role, branch_id) values
      ('${STAFF}', 'الكول سنتر', 'agent', null),
      ('${ASHRY_AGENT}', 'موظف العاشر', 'agent', 'ashry'),
      ('${ADMIN}', 'المدير', 'admin', null);`)
}, 60_000)

afterAll(async () => {
  await db.close()
})

/** Runs fn as an anonymous customer or as a signed-in user id, like PostgREST does. */
async function as<T>(who: string, fn: () => Promise<T>): Promise<T> {
  const role = who === 'anon' ? 'anon' : 'authenticated'
  const sub = who === 'anon' ? '' : who
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
const at = (ts: string) => db.exec(`set app.test_now = '${ts}'`)
const place = (payload: object) =>
  as('anon', async () =>
    (await db.query<{ r: Placed }>('select public.place_order($1::jsonb) as r', [JSON.stringify(payload)])).rows[0].r,
  )
const setStatus = (who: string, id: string, status: string, note?: string) =>
  as(who, () => db.query('select public.set_order_status($1, $2::public.order_status, $3)', [id, status, note ?? null]))

async function sizeId(branch: string, item: string, label = ''): Promise<number> {
  const r = await db.query<{ id: number }>(
    `select s.id from menu_item_sizes s join menu_items i on i.id = s.item_id
     where i.branch_id = $1 and i.name_ar = $2 and s.label = $3`,
    [branch, item, label],
  )
  if (r.rows.length !== 1) throw new Error(`${branch} ${item} ${label}: ${r.rows.length} matches`)
  return Number(r.rows[0].id)
}
async function zoneId(branch: string, name: string): Promise<number> {
  const r = await db.query<{ id: number }>('select id from delivery_zones where branch_id = $1 and name_ar = $2', [branch, name])
  return Number(r.rows[0].id)
}
/** Numbers restart at 01 every day in each branch, so a number needs its branch and date. */
async function orderId(branch: string, number: string, date: string): Promise<string> {
  const r = await db.query<{ id: string }>('select id from orders where branch_id = $1 and order_number = $2 and order_date = $3', [branch, number, date])
  return r.rows[0].id
}
const pickup = async (branch: string, phone: string) => ({
  branch_id: branch,
  order_type: 'pickup',
  customer_name: 'عميل تجربة',
  phone,
  items: [{ size_id: await sizeId(branch, 'صدور فراخ', 'ربع'), qty: 1 }],
})

describe('catalog in the database', () => {
  it('seeds exactly the menu and zones the app shows', async () => {
    for (const b of branches) {
      const r = await db.query<{ category: string; item: string; label: string; price: string }>(
        `select c.name_ar as category, i.name_ar as item, s.label, s.price::text as price
         from menu_item_sizes s join menu_items i on i.id = s.item_id join menu_categories c on c.id = i.category_id
         where c.branch_id = $1 order by c.sort_order, i.sort_order, s.sort_order`,
        [b.id],
      )
      const fromDb = r.rows.map((x) => `${x.category}|${x.item}|${x.label}|${Number(x.price)}`)
      const fromApp = getMenu(b.id).flatMap((c) => c.items.flatMap((i) => i.sizes.map((s) => `${c.name}|${i.name}|${s.label}|${s.price}`)))
      expect(fromDb, b.id).toEqual(fromApp)
      const zones = await db.query<{ n: number }>('select count(*)::int as n from delivery_zones where branch_id = $1 and is_active', [b.id])
      expect(zones.rows[0].n, b.id).toBe(getZones(b.id).length)
    }
    const pending = await db.query<{ n: number }>("select count(*)::int as n from delivery_zones where review_status = 'pending' and not is_active")
    expect(pending.rows[0].n).toBe(16)
  })

  it('lets customers read the catalog but never orders, counters, staff or price changes', async () => {
    await as('anon', async () => {
      expect((await db.query<{ n: number }>('select count(*)::int as n from menu_items')).rows[0].n).toBe(364)
      // Visitors have no privilege at all on orders, counters or staff: refused, not just filtered.
      for (const table of ['orders', 'order_items', 'order_status_history', 'order_counters', 'staff_profiles']) {
        await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/)
      }
      await expect(
        db.query(`insert into orders (order_number, order_date, daily_seq, branch_id, order_type, customer_name, phone, subtotal, total)
                  values ('X-0001', current_date, 1, 'ashry', 'pickup', 'تجربة', '01000000000', 1, 1)`),
      ).rejects.toThrow(/permission denied/)
      await expect(db.query('update menu_item_sizes set price = 1')).rejects.toThrow(/permission denied/)
      await expect(db.query(`select public.set_order_status(gen_random_uuid(), 'preparing')`)).rejects.toThrow(/permission denied/)
    })
  })
})

describe('placing orders', () => {
  beforeAll(() => at('2027-01-04 12:00+02')) // Monday noon in Cairo

  it('prices orders from the database, taxes only Tagamoa and numbers them in one daily sequence', async () => {
    const delivery = {
      branch_id: 'tagamoa',
      order_type: 'delivery',
      customer_name: 'أحمد',
      phone: '01012345678',
      zone_id: await zoneId('tagamoa', 'اللوتس الشمالية'),
      street: 'شارع التسعين',
      building: '12',
      apartment: '3',
      items: [
        // a tampered price is ignored; the item note is cleaned and kept
        { size_id: await sizeId('tagamoa', 'صدور فراخ', 'ربع'), qty: 1, unit_price: 1, note: '  من غير   شطة ' },
        { size_id: await sizeId('tagamoa', 'كفتة فراخ', 'ربع'), qty: 2, note: 'x'.repeat(200) },
      ],
    }
    expect(await place(delivery)).toMatchObject({
      order_number: '01',
      order_date: '2027-01-04',
      subtotal: 630,
      delivery_fee: 75,
      service_amount: 0,
      tax_amount: 88.2,
      total: 793.2,
    })
    expect(await place(await pickup('ashry', '01112345678'))).toMatchObject({ order_number: '02', tax_amount: 0, total: 170 })
    expect((await place({ ...delivery, phone: '01212345678' })).order_number).toBe('03') // all branches share #01, #02, #03 …

    const lines = await db.query<{ name_snapshot: string; unit_price: string; qty: number; note: string | null }>(
      `select name_snapshot, unit_price::text, qty, note from order_items oi join orders o on o.id = oi.order_id
       where o.branch_id = 'tagamoa' and o.order_number = '01' order by oi.id`,
    )
    expect(lines.rows.map((l) => [l.name_snapshot, Number(l.unit_price), l.qty, l.note])).toEqual([
      ['صدور فراخ', 250, 1, 'من غير شطة'],
      ['كفتة فراخ', 190, 2, 'x'.repeat(120)],
    ])
    // the customer sees the note again when tracking the order (typed with or without «#»)
    const tracked = await db.query<{ t: { items: { note: string | null }[] } }>(`select track_order('#01', '01012345678') as t`)
    expect(tracked.rows[0].t.items[0].note).toBe('من غير شطة')
  })

  it('refuses closed or paused branches, hidden zones, booking-only items and bad input', async () => {
    const base = await pickup('zagazig', '01098765432')
    await at('2027-01-04 10:00+02')
    await expect(place(base)).rejects.toThrow(/BRANCH_CLOSED/)
    await at('2027-01-04 12:00+02')

    const delivery = { ...base, order_type: 'delivery', street: 'ش الغشام', building: '5' }
    await expect(place({ ...delivery, zone_id: await zoneId('zagazig', 'كفر صقر') })).rejects.toThrow(/INVALID_ZONE/)
    await expect(place({ ...delivery, zone_id: await zoneId('tagamoa', 'اللوتس الشمالية') })).rejects.toThrow(/INVALID_ZONE/)
    await expect(place({ ...delivery, zone_id: await zoneId('zagazig', 'المحطة'), street: ' ' })).rejects.toThrow(/ADDRESS_REQUIRED/)
    await expect(
      place({ ...base, branch_id: 'tagamoa', items: [{ size_id: await sizeId('tagamoa', 'كتف'), qty: 1 }] }),
    ).rejects.toThrow(/ADVANCE_BOOKING_REQUIRED/)
    await expect(
      place({ ...base, branch_id: 'tagamoa', items: [{ size_id: await sizeId('ashry', 'صدور فراخ', 'ربع'), qty: 1 }] }),
    ).rejects.toThrow(/ITEM_UNAVAILABLE/)
    await expect(place({ ...base, phone: '0554494299' })).rejects.toThrow(/INVALID_PHONE/)
    await expect(place({ ...base, customer_name: 'ا' })).rejects.toThrow(/INVALID_NAME/)
    await expect(place({ ...base, items: [{ ...base.items[0], qty: 0 }] })).rejects.toThrow(/INVALID_QTY/)
    await expect(place({ ...base, items: [] })).rejects.toThrow(/EMPTY_CART/)
    await expect(place({ ...base, order_type: 'dine_in' })).rejects.toThrow(/INVALID_ORDER_TYPE/)

    await db.exec("update branches set accepting_orders = false, pause_reason = 'ضغط' where id = 'zagazig'")
    await expect(place(base)).rejects.toThrow(/BRANCH_PAUSED/)
    await db.exec("update branches set accepting_orders = true, pause_reason = null where id = 'zagazig'")
    expect((await place(base)).order_number).toBe('04')
  })

  it('accepts orders until 01:00 after Thursday and restarts numbering on the new date', async () => {
    await at('2027-01-08 00:30+02') // Friday 00:30, still inside Thursday's hours
    expect(await place(await pickup('ashry', '01512345678'))).toMatchObject({ order_number: '01', order_date: '2027-01-08' })
    await at('2027-01-08 01:00+02')
    await expect(place(await pickup('ashry', '01512345679'))).rejects.toThrow(/BRANCH_CLOSED/)
    await at('2027-01-04 12:00+02')
  })

  it('limits one phone to three orders in ten minutes', async () => {
    await at('2027-01-04 13:00+02')
    for (let i = 0; i < 3; i++) await place(await pickup('ashry', '01011112222'))
    await expect(place(await pickup('ashry', '01011112222'))).rejects.toThrow(/TOO_MANY_ORDERS/)
    await at('2027-01-04 13:11+02')
    expect((await place(await pickup('ashry', '01011112222'))).order_number).toMatch(/^\d{2,}$/)
  })

  it('returns the same order when a checkout is sent twice with its client_ref', async () => {
    await at('2027-01-04 14:00+02')
    const ref = '0f8fad5b-d9cb-469f-a165-70867728950e'
    const payload = { ...(await pickup('zagazig', '01033334444')), client_ref: ref }
    const [a, b] = await Promise.all([place(payload), place(payload)])
    const again = await place(payload)
    expect(b.order_id).toBe(a.order_id)
    expect(again).toEqual(a)
    const count = await db.query<{ n: number }>('select count(*)::int as n from orders where client_ref = $1', [ref])
    expect(count.rows[0].n).toBe(1)
    // The same ref with another phone, or a ref that is not a uuid, is refused.
    await expect(place({ ...payload, phone: '01033334445' })).rejects.toThrow(/INVALID_CLIENT_REF/)
    await expect(place({ ...payload, client_ref: 'abc' })).rejects.toThrow(/INVALID_CLIENT_REF/)
    // Without a ref the call works as before.
    expect((await place(await pickup('zagazig', '01033334446'))).order_id).not.toBe(a.order_id)
  })
})

describe('staff and tracking', () => {
  it('moves an order through the four statuses with a timestamp for each change', async () => {
    const id = await orderId('tagamoa', '01', '2027-01-04')
    await expect(setStatus('anon', id, 'preparing')).rejects.toThrow(/permission denied/)

    await at('2027-01-04 12:05+02')
    await expect(setStatus(STAFF, id, 'out_for_delivery')).rejects.toThrow(/INVALID_TRANSITION/)
    await setStatus(STAFF, id, 'preparing')
    await at('2027-01-04 12:20+02')
    await setStatus(STAFF, id, 'out_for_delivery')

    const track = await as('anon', async () =>
      (await db.query<{ t: Tracked }>("select public.track_order(' 01 ', '01012345678') as t")).rows[0].t,
    )
    expect(track.status).toBe('out_for_delivery')
    expect(track.total).toBe(793.2)
    expect(track.items.map((i) => i.name)).toEqual(['صدور فراخ', 'كفتة فراخ'])
    expect(track.history.map((h) => h.status)).toEqual(['new', 'preparing', 'out_for_delivery'])
    expect(track.history.map((h) => new Date(h.at).toISOString())).toEqual([
      '2027-01-04T10:00:00.000Z',
      '2027-01-04T10:05:00.000Z',
      '2027-01-04T10:20:00.000Z',
    ])
    const who = await db.query<{ changed_by: string | null }>('select changed_by from order_status_history where order_id = $1 order by id', [id])
    expect(who.rows.map((r) => r.changed_by)).toEqual([null, STAFF, STAFF])

    const wrongPhone = await as('anon', async () =>
      (await db.query<{ t: Tracked | null }>("select public.track_order('01', '01099999999') as t")).rows[0].t,
    )
    expect(wrongPhone).toBeNull()
  })

  it('starts the preparation clock on acceptance and moves the order on by itself when the time is up', async () => {
    const times = (id: string) =>
      db.query<{ status: string; ready_from: Date | null; ready_by: Date | null }>('select status, ready_from, ready_by from orders where id = $1', [id]).then((r) => r.rows[0])
    const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null)
    const advance = () => as(STAFF, async () => (await db.query<{ n: number }>('select public.advance_due_orders() as n')).rows[0].n)

    // Delivery (Tagamoa #01, accepted 12:05 in the test above): leaves 45 minutes later.
    const delivery = await times(await orderId('tagamoa', '01', '2027-01-04'))
    expect([iso(delivery.ready_from), iso(delivery.ready_by)]).toEqual(['2027-01-04T10:50:00.000Z', '2027-01-04T10:50:00.000Z'])

    // Pickup: ready in 30 to 45 minutes.
    await at('2027-01-04 13:00+02')
    const placed = await place(await pickup('zagazig', '01044445555'))
    const id = placed.order_id
    await setStatus(STAFF, id, 'preparing')
    let o = await times(id)
    expect([o.status, iso(o.ready_from), iso(o.ready_by)]).toEqual(['preparing', '2027-01-04T11:30:00.000Z', '2027-01-04T11:45:00.000Z'])

    await at('2027-01-04 13:44+02')
    expect(await advance()).toBe(0)
    await at('2027-01-04 13:45+02')
    expect(await advance()).toBeGreaterThanOrEqual(1)
    o = await times(id)
    expect(o.status).toBe('out_for_delivery')
    const auto = await db.query<{ changed_by: string | null; note: string }>(
      "select changed_by, note from order_status_history where order_id = $1 and to_status = 'out_for_delivery'",
      [id],
    )
    expect(auto.rows).toEqual([{ changed_by: null, note: 'تلقائياً بعد انتهاء وقت التجهيز' }])
    await expect(as('anon', () => db.query('select public.advance_due_orders()'))).rejects.toThrow(/permission denied/)

    // The customer sees the expected time, and staff close the order once it is handed over.
    const track = await as('anon', async () =>
      (await db.query<{ t: Tracked & { ready_from: string } }>(`select public.track_order('${placed.order_number}', '01044445555') as t`)).rows[0].t,
    )
    expect(new Date(track.ready_from).toISOString()).toBe('2027-01-04T11:30:00.000Z')
    await setStatus(STAFF, id, 'delivered')
    expect((await times(id)).status).toBe('delivered')
    await expect(setStatus(STAFF, id, 'cancelled', 'سبب')).rejects.toThrow(/INVALID_TRANSITION/)
    await at('2027-01-04 12:00+02')
  })

  it('requires a reason to cancel and never reopens a cancelled order', async () => {
    const id = await orderId('ashry', '02', '2027-01-04')
    await expect(setStatus(STAFF, id, 'cancelled')).rejects.toThrow(/CANCEL_REASON_REQUIRED/)
    await setStatus(STAFF, id, 'cancelled', 'العميل ألغى الطلب')
    await expect(setStatus(STAFF, id, 'preparing')).rejects.toThrow(/INVALID_TRANSITION/)
    const o = await db.query<{ status: string; cancel_reason: string }>('select status, cancel_reason from orders where id = $1', [id])
    expect(o.rows[0]).toEqual({ status: 'cancelled', cancel_reason: 'العميل ألغى الطلب' })
  })

  it('limits a branch agent to that branch and only lets admins change prices', async () => {
    await as(ASHRY_AGENT, async () => {
      const rows = (await db.query<{ branch_id: string }>('select branch_id from orders')).rows
      expect(rows.length).toBeGreaterThan(0)
      expect(new Set(rows.map((r) => r.branch_id))).toEqual(new Set(['ashry']))
    })
    await expect(setStatus(ASHRY_AGENT, await orderId('tagamoa', '03', '2027-01-04'), 'preparing')).rejects.toThrow(/NOT_ALLOWED/)

    const size = await sizeId('ashry', 'صدور فراخ', 'ربع')
    await as(STAFF, async () => {
      expect((await db.query('update menu_item_sizes set price = 999 where id = $1', [size])).affectedRows).toBe(0)
    })
    await as(ADMIN, async () => {
      expect((await db.query('update menu_item_sizes set price = 175 where id = $1', [size])).affectedRows).toBe(1)
      await db.query('update menu_item_sizes set price = 170 where id = $1', [size])
    })
  })

  it('lets only an admin add a delivery zone, which customers can then order to', async () => {
    await at('2027-01-05 12:00+02') // Tuesday noon in Cairo
    const insert = `insert into delivery_zones (branch_id, name_ar, fee, fee_max) values ('tagamoa', 'مدينتي', 150, 150) returning id`
    await expect(as('anon', () => db.query(insert))).rejects.toThrow(/row-level security|permission denied/)
    await expect(as(STAFF, () => db.query(insert))).rejects.toThrow(/row-level security|permission denied/)
    const id = await as(ADMIN, async () => Number((await db.query<{ id: number }>(insert)).rows[0].id))
    await expect(as(ADMIN, () => db.query(insert))).rejects.toThrow(/duplicate key/) // one zone per name in a branch

    const order = {
      branch_id: 'tagamoa',
      order_type: 'delivery',
      customer_name: 'سارة',
      phone: '01500000001',
      zone_id: id,
      street: 'شارع 1',
      building: '5',
      items: [{ size_id: await sizeId('tagamoa', 'صدور فراخ', 'ربع'), qty: 1 }],
    }
    // 250 items + 35 tax (14% of items) + 150 delivery
    expect(await place(order)).toMatchObject({ subtotal: 250, delivery_fee: 150, tax_amount: 35, total: 435 })
    // the zone cannot be used from another branch
    await expect(place({ ...order, branch_id: 'zagazig', phone: '01500000002', items: [{ size_id: await sizeId('zagazig', 'صدور فراخ', 'ربع'), qty: 1 }] })).rejects.toThrow(/INVALID_ZONE/)

    // once the admin switches it off, customers no longer see it or order to it
    await as(ADMIN, () => db.query('update delivery_zones set is_active = false where id = $1', [id]))
    await as('anon', async () => {
      expect((await db.query('select 1 from delivery_zones where id = $1', [id])).rows).toHaveLength(0)
    })
    await expect(place({ ...order, phone: '01500000003' })).rejects.toThrow(/INVALID_ZONE/)
  })
})
