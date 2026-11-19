import { getMenu, getZones } from '../catalog'
import { validateCheckout, emptyCheckoutForm } from '../checkout'
import { errorMessage } from './errors'
import { createLocalApi, memoryStore } from './local'
import { ApiError, type PlaceOrderInput } from './types'

const monday = (h: number, m = 0) => new Date(Date.UTC(2027, 0, 4, h - 2, m)) // Cairo winter time

function setup(start = monday(12)) {
  let clock = start
  const api = createLocalApi({ store: memoryStore(), now: () => clock })
  return { api, setClock: (d: Date) => void (clock = d) }
}

const size = (branch: string, item: string, label = '') =>
  getMenu(branch)
    .flatMap((c) => c.items)
    .find((i) => i.name === item)!
    .sizes.find((s) => s.label === label)!.id

const tagamoaDelivery = (): PlaceOrderInput => ({
  branchId: 'tagamoa',
  orderType: 'delivery',
  customerName: ' أحمد ',
  phone: '٠١٠١٢٣٤٥٦٧٨',
  zoneId: getZones('tagamoa').find((z) => z.name === 'اللوتس الشمالية')!.id,
  street: 'شارع التسعين',
  building: '12',
  lines: [
    { sizeId: size('tagamoa', 'صدور فراخ', 'ربع'), qty: 1 },
    { sizeId: size('tagamoa', 'كفتة فراخ', 'ربع'), qty: 2 },
  ],
})

describe('local demo backend', () => {
  it('lists one day of orders and finds an order by id', async () => {
    const { api, setClock } = setup()
    const first = await api.placeOrder(tagamoaDelivery())
    setClock(new Date(Date.UTC(2027, 0, 5, 10)))
    await api.placeOrder({ ...tagamoaDelivery(), phone: '01012345679' })
    expect((await api.listOrders({ date: '2027-01-04' })).map((o) => o.number)).toEqual(['T-0001'])
    expect(await api.listOrders()).toHaveLength(2)
    expect((await api.getOrder(first.id))?.number).toBe('T-0001')
    expect(await api.getOrder('nope')).toBeNull()
  })

  it('places an order with the same totals and numbering as the database', async () => {
    const { api } = setup()
    const order = await api.placeOrder(tagamoaDelivery())
    expect(order).toMatchObject({
      number: 'T-0001',
      date: '2027-01-04',
      status: 'new',
      customerName: 'أحمد',
      phone: '01012345678',
      zoneLabel: 'اللوتس الشمالية',
      totals: { subtotal: 630, deliveryFee: 75, service: 0, tax: 88.2, total: 793.2 },
    })
    expect(order.history).toEqual([{ from: null, to: 'new', at: '2027-01-04T10:00:00.000Z' }])
    expect((await api.placeOrder({ ...tagamoaDelivery(), phone: '01112345678' })).number).toBe('T-0002')
  })

  it('keeps the customer\'s note on each item, cleaned like the database does', async () => {
    const { api } = setup()
    const input = tagamoaDelivery()
    input.lines = [{ ...input.lines[0], note: '  من غير   شطة ' }, input.lines[1]]
    const order = await api.placeOrder(input)
    expect(order.lines.map((l) => l.note)).toEqual(['من غير شطة', undefined])
  })

  it('returns the same order when a checkout is sent again with its clientRef', async () => {
    const { api, setClock } = setup()
    const input = { ...tagamoaDelivery(), clientRef: '0f8fad5b-d9cb-469f-a165-70867728950e' }
    const [a, b, c] = await Promise.all([api.placeOrder(input), api.placeOrder(input), api.placeOrder(input)])
    expect(b.id).toBe(a.id)
    expect(c.id).toBe(a.id)
    setClock(monday(3)) // the branch has closed since: a retry still gets its order back
    expect((await api.placeOrder(input)).number).toBe('T-0001')
    expect(await api.listOrders()).toHaveLength(1)
    await expect(api.placeOrder({ ...input, phone: '01112345678' })).rejects.toMatchObject({ code: 'INVALID_CLIENT_REF' })
  })

  it('applies the same refusals as the database', async () => {
    const { api, setClock } = setup()
    const base = tagamoaDelivery()
    const code = async (input: PlaceOrderInput) => {
      try {
        await api.placeOrder(input)
        return 'OK'
      } catch (e) {
        return (e as ApiError).code
      }
    }
    expect(await code({ ...base, zoneId: 'tagamoa-z999' })).toBe('INVALID_ZONE')
    expect(await code({ ...base, street: ' ' })).toBe('ADDRESS_REQUIRED')
    expect(await code({ ...base, phone: '0554494299' })).toBe('INVALID_PHONE')
    expect(await code({ ...base, lines: [] })).toBe('EMPTY_CART')
    expect(await code({ ...base, lines: [{ sizeId: size('ashry', 'صدور فراخ', 'ربع'), qty: 1 }] })).toBe('ITEM_UNAVAILABLE')
    expect(await code({ ...base, lines: [{ sizeId: size('tagamoa', 'كتف'), qty: 1 }] })).toBe('ADVANCE_BOOKING_REQUIRED')
    expect(await code({ ...base, lines: [{ ...base.lines[0], qty: 51 }] })).toBe('INVALID_QTY')
    setClock(monday(10))
    expect(await code(base)).toBe('BRANCH_CLOSED')
    setClock(monday(12))
    for (let i = 0; i < 3; i++) expect(await code(base)).toBe('OK')
    expect(await code(base)).toBe('TOO_MANY_ORDERS')
  })

  it('tracks by number and phone, moves through statuses and requires a cancel reason', async () => {
    const { api, setClock } = setup()
    const order = await api.placeOrder(tagamoaDelivery())
    expect(await api.trackOrder('t-0001 ', '01012345678')).toMatchObject({ id: order.id })
    expect(await api.trackOrder('T-0001', '01099999999')).toBeNull()

    await expect(api.setStatus(order.id, 'out_for_delivery')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    setClock(monday(12, 5))
    await api.setStatus(order.id, 'preparing')
    await expect(api.setStatus(order.id, 'cancelled')).rejects.toMatchObject({ code: 'CANCEL_REASON_REQUIRED' })
    const cancelled = await api.setStatus(order.id, 'cancelled', 'العميل لا يرد')
    expect(cancelled.history.map((h) => [h.to, h.at])).toEqual([
      ['new', '2027-01-04T10:00:00.000Z'],
      ['preparing', '2027-01-04T10:05:00.000Z'],
      ['cancelled', '2027-01-04T10:05:00.000Z'],
    ])
    expect(cancelled.cancelReason).toBe('العميل لا يرد')
    expect((await api.setPosInvoice(order.id, ' 5521 ')).posInvoiceNo).toBe('5521')
  })

  it('starts the preparation clock on acceptance and moves the order on by itself when it runs out', async () => {
    const { api, setClock } = setup()
    const pickup = await api.placeOrder({ ...tagamoaDelivery(), orderType: 'pickup', zoneId: undefined, street: undefined, building: undefined })
    const delivery = await api.placeOrder({ ...tagamoaDelivery(), phone: '01012345679' })
    const accepted = await api.setStatus(pickup.id, 'preparing')
    await api.setStatus(delivery.id, 'preparing')
    expect([accepted.readyFrom, accepted.readyBy]).toEqual([monday(12, 30).toISOString(), monday(12, 45).toISOString()])
    expect((await api.getOrder(delivery.id))!.readyBy).toBe(monday(12, 45).toISOString())

    setClock(monday(12, 44))
    expect((await api.getOrder(pickup.id))!.status).toBe('preparing')
    setClock(monday(12, 45))
    const moved = (await api.getOrder(pickup.id))!
    expect(moved.status).toBe('out_for_delivery')
    expect(moved.history.at(-1)).toMatchObject({ to: 'out_for_delivery', note: 'تلقائياً بعد انتهاء وقت التجهيز' })

    // Staff close the order once the customer has it; a closed order cannot be cancelled.
    expect((await api.setStatus(pickup.id, 'delivered')).status).toBe('delivered')
    await expect(api.setStatus(pickup.id, 'cancelled', 'سبب')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })

  it('notifies subscribers when orders change', async () => {
    const { api } = setup()
    const seen: number[] = []
    const stop = api.subscribe(() => seen.push(1))
    await api.placeOrder(tagamoaDelivery())
    stop()
    await api.placeOrder({ ...tagamoaDelivery(), phone: '01112345678' })
    expect(seen).toHaveLength(1)
  })

  it('explains errors in Arabic', () => {
    expect(errorMessage(new ApiError('BRANCH_CLOSED'))).toContain('مغلق')
    expect(errorMessage(new Error('boom'))).toContain('خطأ غير متوقع')
  })
})

describe('delivery zones added by the admin', () => {
  const code = async (run: () => Promise<unknown>) => {
    try {
      await run()
      return 'OK'
    } catch (e) {
      return (e as ApiError).code
    }
  }

  it('adds a zone to one branch only and charges its fee on orders', async () => {
    const { api } = setup()
    const before = await api.listZones('tagamoa')
    expect(before).toEqual(getZones('tagamoa'))

    const zone = await api.addZone('tagamoa', { name: '  مدينتي   الجديدة ', fee: 150 })
    expect(zone).toMatchObject({ name: 'مدينتي الجديدة', label: 'مدينتي الجديدة', type: 'منطقة', fee: 150, custom: true })
    expect(await api.listZones('tagamoa')).toHaveLength(before.length + 1)
    expect((await api.listZones('zagazig')).map((z) => z.label)).not.toContain('مدينتي الجديدة')

    const order = await api.placeOrder({ ...tagamoaDelivery(), zoneId: zone.id })
    expect(order.zoneLabel).toBe('مدينتي الجديدة')
    // 630 items + 88.2 tax (14% of items) + 150 delivery
    expect(order.totals).toMatchObject({ subtotal: 630, deliveryFee: 150, tax: 88.2, total: 868.2 })
    // the same zone id is not valid at another branch
    expect(await code(() => api.placeOrder({ ...tagamoaDelivery(), branchId: 'zagazig', zoneId: zone.id }))).toBe('INVALID_ZONE')
  })

  it('refuses bad names, bad fees and duplicates, including spelling variants', async () => {
    const { api } = setup()
    expect(await code(() => api.addZone('tagamoa', { name: '   ', fee: 50 }))).toBe('INVALID_ZONE_NAME')
    expect(await code(() => api.addZone('tagamoa', { name: 'ا', fee: 50 }))).toBe('INVALID_ZONE_NAME')
    expect(await code(() => api.addZone('tagamoa', { name: 'م'.repeat(61), fee: 50 }))).toBe('INVALID_ZONE_NAME')
    for (const fee of [-1, 5001, 12.5, Number.NaN]) {
      expect(await code(() => api.addZone('tagamoa', { name: 'مدينتي', fee })), String(fee)).toBe('INVALID_ZONE_FEE')
    }
    // already in the branch file
    expect(await code(() => api.addZone('tagamoa', { name: 'اللوتس الشمالية', fee: 80 }))).toBe('ZONE_EXISTS')
    expect(await code(() => api.addZone('tagamoa', { name: 'اللوتس  الشماليه', fee: 80 }))).toBe('ZONE_EXISTS')
    // added twice
    expect(await code(() => api.addZone('tagamoa', { name: 'أرض الجولف', fee: 90 }))).toBe('OK')
    expect(await code(() => api.addZone('tagamoa', { name: 'ارض الجولف', fee: 95 }))).toBe('ZONE_EXISTS')
    // free delivery is allowed, and the same name can exist at another branch
    expect(await code(() => api.addZone('zagazig', { name: 'أرض الجولف', fee: 0 }))).toBe('OK')
    expect(await code(() => api.addZone('cairo' as never, { name: 'مدينتي', fee: 50 }))).toBe('BRANCH_NOT_FOUND')
  })

  it('accepts the branch own zone types and prices a zone the file left pending', async () => {
    const { api } = setup()
    // Ashry groups its zones; "مجاورة 39" is pending in the file (two prices), so customers do not see it.
    expect((await api.listZones('ashry')).map((z) => z.label)).not.toContain('مجاورة 39')
    const zone = await api.addZone('ashry', { type: 'مجاورة', name: '٣٩', fee: 45 })
    expect(zone).toMatchObject({ type: 'مجاورة', name: '39', label: 'مجاورة 39', fee: 45 })
    // "مجاورة 1" exists in the file, also when typed with Arabic digits
    expect(await code(() => api.addZone('ashry', { type: 'مجاورة', name: '١', fee: 30 }))).toBe('ZONE_EXISTS')
    // Tagamoa has plain areas only
    expect(await code(() => api.addZone('tagamoa', { type: 'مجاورة', name: '5', fee: 30 }))).toBe('INVALID_ZONE_TYPE')
  })

  it('removes only zones that were added, and keeps placed orders intact', async () => {
    const { api } = setup()
    const zone = await api.addZone('tagamoa', { name: 'مدينتي', fee: 150 })
    const order = await api.placeOrder({ ...tagamoaDelivery(), zoneId: zone.id })

    const seen: number[] = []
    const stop = api.subscribe(() => seen.push(1))
    await api.removeZone(zone.id)
    stop()
    expect(seen).toHaveLength(1)

    expect(await api.listZones('tagamoa')).toEqual(getZones('tagamoa'))
    expect(await code(() => api.placeOrder({ ...tagamoaDelivery(), phone: '01112345678', zoneId: zone.id }))).toBe('INVALID_ZONE')
    expect((await api.trackOrder(order.number, order.phone))?.totals.deliveryFee).toBe(150)
    expect(await code(() => api.removeZone(getZones('tagamoa')[0].id))).toBe('ZONE_NOT_REMOVABLE')
    expect(await code(() => api.removeZone('nope'))).toBe('ZONE_NOT_FOUND')
  })

  it('explains zone errors in Arabic', () => {
    for (const c of ['INVALID_ZONE_NAME', 'INVALID_ZONE_TYPE', 'INVALID_ZONE_FEE', 'ZONE_EXISTS', 'ZONE_NOT_FOUND', 'ZONE_NOT_REMOVABLE']) {
      expect(errorMessage(new ApiError(c)), c).not.toContain('خطأ غير متوقع')
    }
  })
})

describe('checkout validation', () => {
  it('requires name and phone always, and zone, street and building for delivery', () => {
    expect(validateCheckout(emptyCheckoutForm)).toEqual({
      name: 'اكتب الاسم.',
      phone: 'اكتب رقم موبايل صحيح من 11 رقماً يبدأ بـ 01.',
      zoneId: 'اختر المنطقة.',
      street: 'اكتب اسم الشارع.',
      building: 'اكتب رقم العمارة.',
    })
    expect(validateCheckout({ ...emptyCheckoutForm, orderType: 'pickup', name: 'منى', phone: '01112345678' })).toEqual({})
  })
})
