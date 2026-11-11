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

describe('review sheet and branches', () => {
  it('lists every pending or review zone exactly once', () => {
    const sheet = table('review_conflicts.csv')
    const flagged = Object.keys(ZONES).flatMap((f) => table(f).filter((r) => r.status !== 'ok'))
    const zoneItems = sheet.filter((r) => r.section.startsWith('منطقة'))
    expect(zoneItems).toHaveLength(flagged.length)
    expect(sheet.map((r) => r.id)).toEqual(sheet.map((_, i) => `R${String(i + 1).padStart(2, '0')}`))
    for (const r of sheet) expect(r.owner_decision).toBe('')
  })

  it('describes the three branches and points to existing files', () => {
    const data = JSON.parse(read('branches.json')) as {
      branches: { id: string; phones: string[]; menu_file: string; zones_file: string }[]
    }
    expect(data.branches.map((b) => b.id)).toEqual(['ashry', 'zagazig', 'tagamoa'])
    for (const b of data.branches) {
      expect(b.phones.length).toBeGreaterThan(0)
      expect(Object.keys(MENU)).toContain(b.menu_file)
      expect(Object.keys(ZONES)).toContain(b.zones_file)
    }
  })
})
