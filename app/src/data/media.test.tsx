// Photos, badges and promotions: optional content the owner adds over time.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HeroBanner } from '@/components/HeroBanner'
import { ItemCard } from '@/components/ItemCard'
import { PromoStrip } from '@/components/PromoStrip'
import { branches, getMenu, getMenuStrip, heroBanners, menuImages, type MenuItem } from '@/lib/catalog'
import { imageKey, searchKey } from '@/lib/text'
import { parseCsv } from './csv'

const raw = import.meta.glob<string>(['../../data/menu_extras.csv', '../../data/promotions.json'], { query: '?raw', import: 'default', eager: true })
const read = (name: string) => Object.entries(raw).find(([path]) => path.endsWith(name))![1]
// Base64 copies of the photo files, used only to measure their size.
const photoData = import.meta.glob<string>('../../menu-images/*.{jpg,jpeg,png,webp}', { query: '?inline', import: 'default', eager: true })

const allItems = branches.flatMap((b) => getMenu(b.id).flatMap((c) => c.items))
const sample: MenuItem = { id: 't1', category: 'المشويات', name: 'صدور فراخ', description: 'وصف', sizes: [{ id: 't1-1', label: 'ربع', price: 170 }, { id: 't1-2', label: 'نص', price: 340 }], advanceNoticeHours: null, needsReview: false }

describe('name matching', () => {
  it('treats spelling variants, digits and spacing as the same name', () => {
    expect(searchKey('  كفته   فراخ ')).toBe(searchKey('كفتة فراخ'))
    expect(searchKey('أرز بالخلطة')).toBe(searchKey('ارز بالخلطه'))
    expect(searchKey('مجاورة ٣٩')).toBe(searchKey('مجاورة 39'))
    // a file saved on macOS stores "أ" as two code points
    expect(searchKey('أرز')).toBe(searchKey('أرز'))
  })

  it('matches a photo file name to an item name despite punctuation', () => {
    expect(imageKey('صدور فراخ')).toBe(imageKey('صدور  فراخ'))
    expect(imageKey('ورق عنب - محشي')).toBe(imageKey('ورق عنب / محشي'))
    expect(imageKey('صدور فراخ')).not.toBe(imageKey('كفتة فراخ'))
  })
})

describe('item photos in app/menu-images', () => {
  it('every photo is named after a menu item', () => {
    const known = new Set(allItems.map((i) => imageKey(i.name)))
    const strays = [...menuImages.entries()].filter(([key]) => !known.has(key)).map(([, photo]) => photo.file)
    expect(strays, 'صور اسمها لا يطابق أي صنف').toEqual([])
  })

  it('no photo is heavier than 400 KB', () => {
    const heavy = Object.entries(photoData)
      .map(([path, data]) => ({ file: path.slice(path.lastIndexOf('/') + 1), kb: Math.round((data.slice(data.indexOf(',') + 1).length * 3) / 4 / 1024) }))
      .filter((p) => p.kb > 400)
    expect(heavy, 'صور أكبر من 400 KB').toEqual([])
  })

  it('shows the photo of an item, or the shared placeholder without one', () => {
    const { container, rerender } = render(<ul><ItemCard item={{ ...sample, image: '/menu/x.jpg' }} phone="0100" onAdd={() => {}} /></ul>)
    expect(container.querySelector('img')).toHaveAttribute('src', '/menu/x.jpg')
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')
    rerender(<ul><ItemCard item={sample} phone="0100" onAdd={() => {}} /></ul>)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('button', { name: 'أضف صدور فراخ' })).toBeInTheDocument()
    expect(screen.getByText(/170 ج\.م/)).toBeInTheDocument()
  })
})

describe('badges (data/menu_extras.csv)', () => {
  const rows = parseCsv(read('menu_extras.csv'))

  it('has the expected columns and only refers to real items', () => {
    const header = read('menu_extras.csv').split(/\r?\n/)[0]
    expect(header.charCodeAt(0) === 0xfeff ? header.slice(1) : header).toBe('menu_file,category,item,badge,badge_style')
    for (const row of rows) {
      const branch = branches.find((b) => b.menuFile === row.menu_file)
      const item = branch && getMenu(branch.id).flatMap((c) => c.items).find((i) => i.category === row.category && i.name === row.item)
      expect(item, `${row.menu_file} / ${row.category} / ${row.item}`).toBeDefined()
      expect(row.badge.length, row.item).toBeGreaterThan(0)
      expect(row.badge.length, row.item).toBeLessThanOrEqual(16)
      expect(['', 'a', 'b', 'c'], row.item).toContain(row.badge_style)
    }
    // the app never invents a badge: items carry one only when the file lists it
    expect(allItems.filter((i) => i.badge)).toHaveLength(new Set(rows.flatMap((r) => branches.filter((b) => b.menuFile === r.menu_file).map((b) => `${b.id}|${r.category}|${r.item}`))).size)
  })

  it('draws a badge over the photo when an item has one', () => {
    render(<ul><ItemCard item={{ ...sample, badge: { text: 'تجربة', style: 'b' } }} phone="0100" onAdd={() => {}} /></ul>)
    expect(screen.getByText('تجربة')).toHaveClass('bg-badge-b')
  })
})

describe('promotions (data/promotions.json)', () => {
  it('holds only complete entries', () => {
    const data = JSON.parse(read('promotions.json')) as { hero: { title?: string; cta_label?: string }[]; menu_strip: { text?: string } | null }
    for (const h of data.hero) {
      expect(h.title).toBeTruthy()
      expect(h.cta_label).toBeTruthy()
    }
    if (data.menu_strip) expect(data.menu_strip.text).toBeTruthy()
    expect(heroBanners).toHaveLength(data.hero.length)
    expect(getMenuStrip('ashry') === null).toBe(data.menu_strip === null)
  })

  it('draws nothing without content, and the banner and strip with it', () => {
    const { container, rerender } = render(<MemoryRouter><HeroBanner banners={[]} onBrowse={() => {}} /><PromoStrip strip={null} /></MemoryRouter>)
    expect(container).toBeEmptyDOMElement()

    // sample texts live in this test only; real content comes from the owner
    rerender(
      <MemoryRouter>
        <HeroBanner banners={[{ title: 'عنوان تجريبي', description: 'وصف تجريبي', ctaLabel: 'اطلب الآن', branchId: 'ashry' }]} onBrowse={() => {}} />
        <PromoStrip strip={{ text: 'نص عرض تجريبي', circle: '30%' }} />
      </MemoryRouter>,
    )
    expect(screen.getByText('عنوان تجريبي')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'اطلب الآن' })).toHaveAttribute('href', '/branch/ashry')
    expect(screen.getByRole('note')).toHaveTextContent('نص عرض تجريبي')
    expect(screen.getByText('30%')).toBeInTheDocument()
  })
})
