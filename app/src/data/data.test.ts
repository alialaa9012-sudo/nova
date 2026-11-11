import { parseCsv } from './csv'

// Data files live in app/data (outside src); Vite inlines them as raw text for the tests.
const files = import.meta.glob<string>('../../data/*.{csv,json}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const read = (name: string): string => {
  const hit = Object.entries(files).find(([path]) => path.endsWith(`/${name}`))
  if (!hit) throw new Error(`missing data file: ${name}`)
  return hit[1]
}
const table = (name: string) => parseCsv(read(name))

// Expected row counts. Update deliberately when the owner changes the menus or zones.
const MENU = {
  'menu_ashry_zagazig.csv': { rows: 165, active: 158, check: 2, excluded: 7 },
  'menu_tagamoa.csv': { rows: 158, active: 158, check: 1, excluded: 0 },
} as const
const ZONES = {
  'delivery_zones_ashry.csv': { rows: 144, pending: 8, review: 0 },
  'delivery_zones_zagazig.csv': { rows: 81, pending: 8, review: 0 },
  'delivery_zones_tagamoa.csv': { rows: 71, pending: 0, review: 6 },
} as const

const MENU_COLUMNS = [
  'category', 'item', 'size_label', 'price', 'description',
  'advance_notice_hours', 'status', 'note', 'source',
]
const ZONE_COLUMNS = [
  'branch', 'zone_type', 'zone_name', 'fee_min', 'fee_max', 'status', 'note', 'source',
]
const SIZES = ['', 'ربع', 'تلت', 'نص', 'كيلو', 'فرخة']

describe('parseCsv', () => {
  it('handles BOM, quoted commas, escaped quotes and CRLF', () => {
    const rows = parseCsv('\uFEFFa,b\r\n"x,1","he said ""hi"""\r\n,2\r\n')
    expect(rows).toEqual([
      { a: 'x,1', b: 'he said "hi"' },
      { a: '', b: '2' },
    ])
  })

  it('reads a final row without a trailing newline and skips blank lines', () => {
    expect(parseCsv('a,b\n\n1,2')).toEqual([{ a: '1', b: '2' }])
    expect(parseCsv('')).toEqual([])
  })
})

describe.each(Object.entries(MENU))('menu %s', (file, expected) => {
  const rows = table(file)

  it('has the expected columns and row counts', () => {
    expect(Object.keys(rows[0])).toEqual(MENU_COLUMNS)
    expect(rows).toHaveLength(expected.rows)
    expect(rows.filter((r) => r.status !== 'excluded')).toHaveLength(expected.active)
    expect(rows.filter((r) => r.status === 'check')).toHaveLength(expected.check)
    expect(rows.filter((r) => r.status === 'excluded')).toHaveLength(expected.excluded)
  })

  it('has positive whole-number prices and a known status and size', () => {
    for (const r of rows) {
      expect(r.price, `${r.item} ${r.size_label}`).toMatch(/^[1-9]\d*$/)
      expect(['ok', 'check', 'excluded']).toContain(r.status)
      expect(SIZES).toContain(r.size_label)
      expect(r.advance_notice_hours).toMatch(/^(\d+)?$/)
      expect(r.category.trim()).not.toBe('')
      expect(r.item.trim()).not.toBe('')
    }
  })

  it('has no duplicate (category, item, size) rows', () => {
    const keys = rows.map((r) => [r.category, r.item, r.size_label].join('|'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps sizes of one item in ascending price order', () => {
    const order = ['ربع', 'تلت', 'نص', 'كيلو']
    const byItem = new Map<string, { size: string; price: number }[]>()
    for (const r of rows.filter((x) => order.includes(x.size_label))) {
      const key = `${r.category}|${r.item}`
      byItem.set(key, [...(byItem.get(key) ?? []), { size: r.size_label, price: Number(r.price) }])
    }
    for (const [key, sizes] of byItem) {
      const sorted = [...sizes].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size))
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].price, key).toBeGreaterThan(sorted[i - 1].price)
      }
    }
  })

  it('flags every non-ok row with a note', () => {
    for (const r of rows.filter((x) => x.status !== 'ok')) {
      expect(r.note.trim(), r.item).not.toBe('')
    }
  })
})

describe.each(Object.entries(ZONES))('zones %s', (file, expected) => {
  const rows = table(file)

  it('has the expected columns and counts', () => {
    expect(Object.keys(rows[0])).toEqual(ZONE_COLUMNS)
    expect(rows).toHaveLength(expected.rows)
    expect(rows.filter((r) => r.status === 'pending')).toHaveLength(expected.pending)
    expect(rows.filter((r) => r.status === 'review')).toHaveLength(expected.review)
  })

  it('never exposes an active zone without a single clear fee', () => {
    for (const r of rows) {
      expect(['ok', 'review', 'pending']).toContain(r.status)
      expect(r.fee_min).toMatch(/^[1-9]\d*$/)
      expect(r.fee_max).toMatch(/^[1-9]\d*$/)
      expect(Number(r.fee_min)).toBeLessThanOrEqual(Number(r.fee_max))
      if (r.status !== 'pending') expect(r.fee_min, r.zone_name).toBe(r.fee_max)
      if (r.status !== 'ok') expect(r.note.trim(), r.zone_name).not.toBe('')
    }
  })

  it('has no duplicate zone names per type', () => {
    const keys = rows.map((r) => `${r.zone_type}|${r.zone_name}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

type Day = { opens: string; closes: string; crosses_midnight: boolean }
type BranchesFile = {
  brand: {
    social: Record<string, { handle: string; url: string; source: string; url_verified: boolean }[]>
    linktree: string
    whatsapp: { number: string; url: string; scope: string }
    logo: { file: string; url_path: string; width: number; height: number }
  }
  branches: {
    id: string
    phones: string[]
    menu_file: string
    zones_file: string
    maps_url: string
    lat: number
    lng: number
    timezone: string
    working_hours: Record<string, Day>
    order_reception: { same_as_working_hours: boolean }
    online_charges: { service_percent: number; tax_percent: number; tax_base: string; tax_base_confirmed: boolean }
    missing: string[]
  }[]
}
const branchesFile = () => JSON.parse(read('branches.json')) as BranchesFile
const WEEK = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

describe('review sheet and branches', () => {
  it('lists every pending or review zone exactly once and records the owner decisions', () => {
    const sheet = table('review_conflicts.csv')
    const flagged = Object.keys(ZONES).flatMap((f) => table(f).filter((r) => r.status !== 'ok'))
    const zoneItems = sheet.filter((r) => r.section.startsWith('منطقة'))
    expect(zoneItems).toHaveLength(flagged.length)
    expect(sheet.map((r) => r.id)).toEqual(sheet.map((_, i) => `R${String(i + 1).padStart(2, '0')}`))
    const decided = new Set(sheet.filter((r) => r.owner_decision.trim() !== '').map((r) => r.subject))
    const answered = [
      'أرقام واتساب', 'مواعيد العمل واستقبال الطلبات', 'نسبة الخدمة',
      'نسبة الخدمة والضريبة', 'رابط المنيو في Linktree', 'حساب إنستجرام',
    ]
    for (const subject of answered) expect(decided.has(subject), subject).toBe(true)
    for (const r of zoneItems) expect(r.owner_decision, r.subject).toBe('')
  })

  it('describes the three branches and points to existing files', () => {
    const data = branchesFile()
    expect(data.branches.map((b) => b.id)).toEqual(['ashry', 'zagazig', 'tagamoa'])
    for (const b of data.branches) {
      expect(b.phones.length).toBeGreaterThan(0)
      expect(Object.keys(MENU)).toContain(b.menu_file)
      expect(Object.keys(ZONES)).toContain(b.zones_file)
    }
  })

  it('has Google Maps links with Egyptian coordinates and https social links', () => {
    const data = branchesFile()
    for (const b of data.branches) {
      expect(b.maps_url, b.id).toMatch(/^https:\/\/www\.google\.com\/maps\/place\//)
      expect(b.maps_url, b.id).not.toContain('g_ep=')
      expect(b.lat, b.id).toBeGreaterThan(22)
      expect(b.lat, b.id).toBeLessThan(32)
      expect(b.lng, b.id).toBeGreaterThan(24)
      expect(b.lng, b.id).toBeLessThan(37)
      expect(b.missing, b.id).not.toContain('maps_url')
    }
    expect(Object.keys(data.brand.social).sort()).toEqual(['facebook', 'instagram', 'snapchat', 'tiktok'])
    expect(data.brand.social.instagram.map((a) => a.handle)).toEqual(['khaliha.mashawy', 'mashawy.eg'])
    const urls = Object.values(data.brand.social).flatMap((accounts) => accounts.map((a) => a.url))
    for (const url of [...urls, data.brand.linktree]) {
      expect(url).toMatch(/^https:\/\//)
      expect(url).not.toContain('fbclid')
      expect(url).not.toContain('mibextid')
    }
  })

  it('has the weekly opening hours for every branch, closing after midnight', () => {
    for (const b of branchesFile().branches) {
      expect(b.timezone, b.id).toBe('Africa/Cairo')
      expect(Object.keys(b.working_hours), b.id).toEqual(WEEK)
      for (const day of WEEK) {
        const h = b.working_hours[day]
        expect(h.opens, `${b.id} ${day}`).toBe('11:00')
        expect(h.closes, `${b.id} ${day}`).toBe(day === 'thu' || day === 'fri' ? '01:00' : '00:00')
        expect(h.opens).toMatch(HHMM)
        expect(h.closes).toMatch(HHMM)
        expect(h.crosses_midnight, `${b.id} ${day}`).toBe(true)
      }
      expect(b.order_reception.same_as_working_hours, b.id).toBe(true)
      for (const field of ['working_hours', 'order_reception_hours', 'whatsapp']) {
        expect(b.missing, b.id).not.toContain(field)
      }
    }
  })

  it('has one WhatsApp number whose wa.me link matches it, and the logo metadata', () => {
    const { brand } = branchesFile()
    expect(brand.whatsapp.number).toMatch(/^01[0125]\d{8}$/)
    expect(brand.whatsapp.url).toBe(`https://wa.me/20${brand.whatsapp.number.slice(1)}`)
    expect(brand.whatsapp.scope).toBe('all_branches')
    expect(brand.logo.url_path).toBe('/brand/logo-dark.jpg')
    expect(brand.logo.width).toBeGreaterThan(0)
    expect(brand.logo.height).toBeGreaterThan(0)
  })

  it('records the online charges decided by the owner', () => {
    for (const b of branchesFile().branches) {
      expect(b.online_charges.service_percent, b.id).toBe(0)
      expect(b.online_charges.tax_percent, b.id).toBe(14)
      expect(b.online_charges.tax_base, b.id).toBe('items_only')
      expect(b.online_charges.tax_base_confirmed, b.id).toBe(false)
    }
  })
})
