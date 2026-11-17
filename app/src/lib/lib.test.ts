import { cartCount, cartReducer, cleanNote, lineKey, MAX_NOTE, cartSubtotal, MAX_QTY, type CartLine } from './cart'
import { branches, findSize, getBranch, getMenu, getZones } from './catalog'
import { formatEGP } from './format'
import { formatTimeAr, formatTimeShort, getOpenStatus, summarizeHours, type WeeklyHours } from './hours'
import { canTransition, nextStatus, statusLabel } from './orderStatus'
import { normalizeEgyptianMobile, toAsciiDigits } from './phone'
import { computeTotals } from './pricing'

// Cairo wall-clock time in January (UTC+2, no daylight saving).
const cairoWinter = (day: number, h: number, m = 0) => new Date(Date.UTC(2027, 0, day, h - 2, m))
// 2027-01-04 Monday, 07 Thursday, 08 Friday, 09 Saturday, 10 Sunday.
const hours = getBranch('ashry')!.hours

describe('opening hours', () => {
  it.each([
    ['Monday 10:59', cairoWinter(4, 10, 59), false],
    ['Monday 11:00', cairoWinter(4, 11, 0), true],
    ['Monday 23:59', cairoWinter(4, 23, 59), true],
    ['Tuesday 00:00 (Monday closed at midnight)', cairoWinter(5, 0, 0), false],
    ['Thursday 23:30', cairoWinter(7, 23, 30), true],
    ['Friday 00:30 (Thursday open until 01:00)', cairoWinter(8, 0, 30), true],
    ['Friday 01:00', cairoWinter(8, 1, 0), false],
    ['Saturday 00:59 (Friday open until 01:00)', cairoWinter(9, 0, 59), true],
    ['Sunday 00:30 (Saturday closed at midnight)', cairoWinter(10, 0, 30), false],
  ])('%s -> open: %s', (_label, date, open) => {
    expect(getOpenStatus(hours, date).isOpen).toBe(open)
  })

  it('reports when a closed branch opens next and when an open one closes', () => {
    expect(getOpenStatus(hours, cairoWinter(4, 9, 0))).toEqual({ isOpen: false, opensAt: '11:00', opensDay: 'mon' })
    expect(getOpenStatus(hours, cairoWinter(7, 20, 0))).toEqual({ isOpen: true, closesAt: '01:00' })
  })

  it('follows Cairo daylight saving time in summer', () => {
    // 2027-07-05 is a Monday; Egypt is UTC+3 in July, so 08:30 UTC is 11:30 in Cairo.
    expect(getOpenStatus(hours, new Date(Date.UTC(2027, 6, 5, 8, 30))).isOpen).toBe(true)
    expect(getOpenStatus(hours, new Date(Date.UTC(2027, 6, 5, 7, 30))).isOpen).toBe(false)
  })

  it('summarizes the week in Arabic', () => {
    expect(summarizeHours(hours)).toEqual([
      { days: 'السبت إلى الأربعاء', text: 'من 11 صباحاً إلى 12 منتصف الليل' },
      { days: 'الخميس والجمعة', text: 'من 11 صباحاً إلى 1 بعد منتصف الليل' },
    ])
    expect(formatTimeAr('18:30')).toBe('6:30 مساءً')
  })

  it('has a short form for the status badge', () => {
    expect(formatTimeShort('00:00')).toBe('12 ليلاً')
    expect(formatTimeShort('01:00')).toBe('1 ليلاً')
    expect(formatTimeShort('00:30')).toBe('12:30 ليلاً')
    expect(formatTimeShort('11:00')).toBe('11 صباحاً')
    expect(formatTimeShort('19:00')).toBe('7 مساءً')
  })

  it('handles a week with a day off', () => {
    const custom = { ...hours, fri: undefined } as unknown as WeeklyHours
    expect(getOpenStatus(custom, cairoWinter(8, 12, 0))).toMatchObject({ isOpen: false, opensDay: 'sat' })
  })
})

describe('totals', () => {
  const lines = [
    { unitPrice: 250, qty: 1 },
    { unitPrice: 190, qty: 2 },
  ]

  it('adds 14% tax on the items only in Tagamoa', () => {
    const t = computeTotals(lines, 'delivery', 75, getBranch('tagamoa')!.charges)
    expect(t).toEqual({ subtotal: 630, deliveryFee: 75, service: 0, tax: 88.2, total: 793.2 })
  })

  it('adds no tax and no service in Ashry and Zagazig', () => {
    for (const id of ['ashry', 'zagazig']) {
      expect(computeTotals(lines, 'delivery', 75, getBranch(id)!.charges).total).toBe(705)
    }
  })

  it('charges no delivery fee for pickup and can tax the delivery fee when configured', () => {
    expect(computeTotals(lines, 'pickup', 75, getBranch('ashry')!.charges)).toMatchObject({ deliveryFee: 0, total: 630 })
    const t = computeTotals(lines, 'delivery', 100, { service_percent: 0, tax_percent: 14, tax_base: 'items_and_delivery' })
    expect(t.tax).toBe(102.2)
  })
})

describe('phone numbers', () => {
  it.each([
    ['01061005627', '01061005627'],
    ['010 6100 5627', '01061005627'],
    ['+201061005627', '01061005627'],
    ['00201061005627', '01061005627'],
    ['٠١٠٦١٠٠٥٦٢٧', '01061005627'],
    ['01588888369', '01588888369'],
    ['0554494299', null],
    ['01361005627', null],
    ['0106100562', null],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeEgyptianMobile(input)).toBe(expected)
  })

  it('converts Persian digits too', () => {
    expect(toAsciiDigits('۰۱۲۳')).toBe('0123')
  })
})

describe('order statuses', () => {
  it('labels the third status by order type without adding statuses', () => {
    expect(statusLabel('out_for_delivery', 'delivery')).toBe('خرج للتوصيل')
    expect(statusLabel('out_for_delivery', 'pickup')).toBe('جاهز للاستلام')
    expect(statusLabel('preparing', 'pickup')).toBe('تم استلام طلبك وجاري التجهيز')
  })

  it('moves forward one step at a time and can always cancel until cancelled', () => {
    expect(nextStatus('new')).toBe('preparing')
    expect(nextStatus('out_for_delivery')).toBeNull()
    expect(canTransition('new', 'out_for_delivery')).toBe(false)
    expect(canTransition('preparing', 'out_for_delivery')).toBe(true)
    expect(canTransition('out_for_delivery', 'cancelled')).toBe(true)
    expect(canTransition('cancelled', 'new')).toBe(false)
  })
})

describe('catalog', () => {
  it('loads the three branches with their order codes', () => {
    expect(branches.map((b) => [b.id, b.code])).toEqual([
      ['ashry', 'A'],
      ['zagazig', 'Z'],
      ['tagamoa', 'T'],
    ])
  })

  it('builds each menu from the active rows only', () => {
    const sizes = (id: string) => getMenu(id).flatMap((c) => c.items.flatMap((i) => i.sizes))
    expect(sizes('ashry')).toHaveLength(158)
    expect(sizes('zagazig')).toHaveLength(158)
    expect(sizes('tagamoa')).toHaveLength(158)
    expect(getMenu('ashry').map((c) => c.name)).not.toContain('التسويات')
    const grill = getMenu('ashry').find((c) => c.name === 'المشويات')!.items.find((i) => i.name === 'صدور فراخ')!
    expect(grill.sizes.map((s) => [s.label, s.price])).toEqual([
      ['ربع', 170],
      ['تلت', 235],
      ['نص', 340],
      ['كيلو', 680],
    ])
    expect(findSize('ashry', grill.sizes[0].id)?.size.price).toBe(170)
    expect(findSize('tagamoa', grill.sizes[0].id)).toBeUndefined()
  })

  it('marks advance-booking items and offers only zones with one clear fee', () => {
    const roast = getMenu('tagamoa').flatMap((c) => c.items).find((i) => i.name === 'كتف')!
    expect(roast.advanceNoticeHours).toBe(24)
    expect(getZones('ashry')).toHaveLength(136)
    expect(getZones('zagazig')).toHaveLength(73)
    expect(getZones('tagamoa')).toHaveLength(71)
    expect(getZones('zagazig').map((z) => z.name)).not.toContain('كفر صقر')
    expect(getZones('ashry')[0].label).toBe('مجاورة 1')
  })
})

describe('cart', () => {
  const line = { sizeId: 'w1-1', itemId: 'w1', name: 'صدور فراخ', sizeLabel: 'ربع', unitPrice: 170 }

  it('adds, merges, updates, removes and caps quantities', () => {
    let s: CartLine[] = []
    s = cartReducer(s, { type: 'add', line, qty: 1 })
    s = cartReducer(s, { type: 'add', line, qty: 2 })
    expect(s).toHaveLength(1)
    expect(cartCount(s)).toBe(3)
    expect(cartSubtotal(s)).toBe(510)
    s = cartReducer(s, { type: 'setQty', key: lineKey(line), qty: 999 })
    expect(s[0].qty).toBe(MAX_QTY)
    s = cartReducer(s, { type: 'setQty', key: lineKey(line), qty: 0 })
    expect(s).toEqual([])
    expect(cartReducer([{ ...line, qty: 1 }], { type: 'clear' })).toEqual([])
  })

  it('keeps the same item with a different note on its own line', () => {
    let s: CartLine[] = []
    s = cartReducer(s, { type: 'add', line, qty: 1 })
    s = cartReducer(s, { type: 'add', line: { ...line, note: '  من غير   شطة ' }, qty: 1 })
    s = cartReducer(s, { type: 'add', line: { ...line, note: 'من غير شطة' }, qty: 2 })
    expect(s).toHaveLength(2)
    expect(s[1]).toMatchObject({ note: 'من غير شطة', qty: 3 })
    s = cartReducer(s, { type: 'remove', key: lineKey({ sizeId: 'w1-1', note: 'من غير شطة' }) })
    expect(s).toEqual([{ ...line, note: undefined, qty: 1 }])
  })

  it('cleans notes and caps them at 120 characters', () => {
    expect(cleanNote('   ')).toBeUndefined()
    expect(cleanNote('a'.repeat(200))).toHaveLength(MAX_NOTE)
  })
})

describe('formatting', () => {
  it('prints prices with Latin digits', () => {
    expect(formatEGP(793.2)).toBe('793.2 ج.م')
    expect(formatEGP(1900)).toBe('1,900 ج.م')
  })
})

describe('search with synonyms', async () => {
  const { matchesSearch } = await import('./text')
  it('finds chicken whether the customer types دجاج, فراخ or فرخة', () => {
    expect(matchesSearch('صدور فراخ', 'دجاج')).toBe(true)
    expect(matchesSearch('فرخة مشوية', 'دجاج')).toBe(true)
    expect(matchesSearch('فرخة مسحب', 'فراخ')).toBe(true)
    expect(matchesSearch('كفتة بقري', 'دجاج')).toBe(false)
  })
  it('keeps spelling tolerance and needs every word', () => {
    expect(matchesSearch('كفتة فراخ', 'كفته دجاج')).toBe(true)
    expect(matchesSearch('كفتة بقري', 'كفته دجاج')).toBe(false)
    expect(matchesSearch('أرز بسمتي', 'رز')).toBe(true)
    expect(matchesSearch('مشروب غازي', 'بيبسي')).toBe(true)
    expect(matchesSearch('شاي', '')).toBe(true)
  })
})

describe('reorder', async () => {
  const { reorderLines } = await import('./reorder')
  it('puts past items back at today\'s price and reports those no longer sold', () => {
    const { lines, missing } = reorderLines('ashry', {
      lines: [
        { name: 'صدور فراخ', sizeLabel: 'ربع', unitPrice: 1, qty: 2, lineTotal: 2, note: 'من غير شطة' },
        { name: 'صنف قديم', sizeLabel: '', unitPrice: 50, qty: 1, lineTotal: 50 },
      ],
    })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ name: 'صدور فراخ', sizeLabel: 'ربع', unitPrice: 170, qty: 2, note: 'من غير شطة' })
    expect(missing).toEqual(['صنف قديم'])
  })
})

describe('Arabic dates', async () => {
  const { formatDateAr } = await import('./format')
  it('writes the board date in words, so 01/04 is never read as April', () => {
    expect(formatDateAr('2027-01-04')).toBe('الاثنين، 4 يناير 2027')
    expect(formatDateAr('')).toBe('')
  })
})
