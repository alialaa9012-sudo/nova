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
