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
async function orderId(number: string, date: string): Promise<string> {
  const r = await db.query<{ id: string }>('select id from orders where order_number = $1 and order_date = $2', [number, date])
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
      expect((await db.query('select * from orders')).rows).toHaveLength(0)
      expect((await db.query('select * from order_counters')).rows).toHaveLength(0)
      expect((await db.query('select * from staff_profiles')).rows).toHaveLength(0)
      await expect(
        db.query(`insert into orders (order_number, order_date, daily_seq, branch_id, order_type, customer_name, phone, subtotal, total)
                  values ('X-0001', current_date, 1, 'ashry', 'pickup', 'تجربة', '01000000000', 1, 1)`),
      ).rejects.toThrow(/row-level security/)
      expect((await db.query('update menu_item_sizes set price = 1')).affectedRows).toBe(0)
      await expect(db.query(`select public.set_order_status(gen_random_uuid(), 'preparing')`)).rejects.toThrow(/permission denied/)
    })
  })
})

describe('placing orders', () => {
  beforeAll(() => at('2027-01-04 12:00+02')) // Monday noon in Cairo

  it('prices orders from the database, taxes only Tagamoa and numbers them per branch per day', async () => {
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
        { size_id: await sizeId('tagamoa', 'صدور فراخ', 'ربع'), qty: 1, unit_price: 1 }, // a tampered price is ignored
        { size_id: await sizeId('tagamoa', 'كفتة فراخ', 'ربع'), qty: 2 },
      ],
    }
    expect(await place(delivery)).toMatchObject({
      order_number: 'T-0001',
      order_date: '2027-01-04',
      subtotal: 630,
      delivery_fee: 75,
      service_amount: 0,
      tax_amount: 88.2,
      total: 793.2,
    })
    expect(await place(await pickup('ashry', '01112345678'))).toMatchObject({ order_number: 'A-0001', tax_amount: 0, total: 170 })
    expect((await place({ ...delivery, phone: '01212345678' })).order_number).toBe('T-0002')

    const lines = await db.query<{ name_snapshot: string; unit_price: string; qty: number }>(
      `select name_snapshot, unit_price::text, qty from order_items oi join orders o on o.id = oi.order_id
       where o.order_number = 'T-0001' order by oi.id`,
    )
    expect(lines.rows.map((l) => [l.name_snapshot, Number(l.unit_price), l.qty])).toEqual([
      ['صدور فراخ', 250, 1],
      ['كفتة فراخ', 190, 2],
    ])
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
    expect((await place(base)).order_number).toBe('Z-0001')
  })

  it('accepts orders until 01:00 after Thursday and restarts numbering on the new date', async () => {
    await at('2027-01-08 00:30+02') // Friday 00:30, still inside Thursday's hours
    expect(await place(await pickup('ashry', '01512345678'))).toMatchObject({ order_number: 'A-0001', order_date: '2027-01-08' })
    await at('2027-01-08 01:00+02')
    await expect(place(await pickup('ashry', '01512345679'))).rejects.toThrow(/BRANCH_CLOSED/)
    await at('2027-01-04 12:00+02')
  })

  it('limits one phone to three orders in ten minutes', async () => {
    await at('2027-01-04 13:00+02')
    for (let i = 0; i < 3; i++) await place(await pickup('ashry', '01011112222'))
    await expect(place(await pickup('ashry', '01011112222'))).rejects.toThrow(/TOO_MANY_ORDERS/)
    await at('2027-01-04 13:11+02')
    expect((await place(await pickup('ashry', '01011112222'))).order_number).toMatch(/^A-\d{4}$/)
  })
})

describe('staff and tracking', () => {
  it('moves an order through the four statuses with a timestamp for each change', async () => {
    const id = await orderId('T-0001', '2027-01-04')
    await expect(setStatus('anon', id, 'preparing')).rejects.toThrow(/permission denied/)

    await at('2027-01-04 12:05+02')
    await expect(setStatus(STAFF, id, 'out_for_delivery')).rejects.toThrow(/INVALID_TRANSITION/)
    await setStatus(STAFF, id, 'preparing')
    await at('2027-01-04 12:20+02')
    await setStatus(STAFF, id, 'out_for_delivery')

    const track = await as('anon', async () =>
      (await db.query<{ t: Tracked }>("select public.track_order(' t-0001 ', '01012345678') as t")).rows[0].t,
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
      (await db.query<{ t: Tracked | null }>("select public.track_order('T-0001', '01099999999') as t")).rows[0].t,
    )
    expect(wrongPhone).toBeNull()
  })

  it('requires a reason to cancel and never reopens a cancelled order', async () => {
    const id = await orderId('A-0001', '2027-01-04')
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
    await expect(setStatus(ASHRY_AGENT, await orderId('T-0002', '2027-01-04'), 'preparing')).rejects.toThrow(/NOT_ALLOWED/)

    const size = await sizeId('ashry', 'صدور فراخ', 'ربع')
    await as(STAFF, async () => {
      expect((await db.query('update menu_item_sizes set price = 999 where id = $1', [size])).affectedRows).toBe(0)
    })
    await as(ADMIN, async () => {
      expect((await db.query('update menu_item_sizes set price = 175 where id = $1', [size])).affectedRows).toBe(1)
      await db.query('update menu_item_sizes set price = 170 where id = $1', [size])
    })
  })
})
