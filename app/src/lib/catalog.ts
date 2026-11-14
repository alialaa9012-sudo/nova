// Read-only catalog built from the approved data files in app/data.
// The same files generate the database seed, so the app and the database agree.
import { parseCsv } from '@/data/csv'
import branchesRaw from '../../data/branches.json?raw'
import zonesAshryRaw from '../../data/delivery_zones_ashry.csv?raw'
import zonesTagamoaRaw from '../../data/delivery_zones_tagamoa.csv?raw'
import zonesZagazigRaw from '../../data/delivery_zones_zagazig.csv?raw'
import menuWhiteRaw from '../../data/menu_ashry_zagazig.csv?raw'
import menuExtrasRaw from '../../data/menu_extras.csv?raw'
import menuBlackRaw from '../../data/menu_tagamoa.csv?raw'
import promotionsRaw from '../../data/promotions.json?raw'
import type { WeeklyHours } from './hours'
import type { Charges, TaxBase } from './pricing'
import { imageKey } from './text'
import { zoneLabel } from './zones'

export type BranchId = 'ashry' | 'zagazig' | 'tagamoa'

export interface Branch {
  id: BranchId
  code: string
  name: string
  address: string
  phones: string[]
  mapsUrl: string
  timezone: string
  hours: WeeklyHours
  charges: Charges
  menuFile: string
  zonesFile: string
}

export interface Brand {
  name: string
  whatsappNumber: string
  whatsappUrl: string
  logoUrl: string
  logoWidth: number
  logoHeight: number
}

export interface MenuSize {
  id: string
  label: string
  price: number
}

export interface MenuItem {
  id: string
  category: string
  name: string
  description: string
  sizes: MenuSize[]
  advanceNoticeHours: number | null
  needsReview: boolean
  /** Photo URL, when a file named after the item exists in app/menu-images. */
  image?: string
  /** Short label over the photo, from data/menu_extras.csv. Never invented by the app. */
  badge?: { text: string; style: BadgeStyle }
}

export type BadgeStyle = 'a' | 'b' | 'c'

/** A banner on the home page. Shown only when the owner supplies real content. */
export interface HeroBanner {
  badge?: string
  title: string
  description?: string
  ctaLabel: string
  /** Opens this branch menu; without it the button scrolls to the branch list. */
  branchId?: BranchId
  image?: string
}

/** An offer strip on the menu page. Display only: the app applies no discount by itself. */
export interface MenuStrip {
  text: string
  /** Short text inside the circle, e.g. "30%". */
  circle?: string
}

export interface MenuCategory {
  id: string
  name: string
  items: MenuItem[]
}

export interface DeliveryZone {
  id: string
  type: string
  name: string
  label: string
  fee: number
  needsReview: boolean
  /** Added from the admin screen (not part of the branch's original list). */
  custom?: boolean
}

/** A zone from the branch file that has no single fee yet, so customers never see it. */
export interface PendingZone {
  type: string
  name: string
  label: string
  feeMin: number
  feeMax: number
  note: string
}

interface RawBranches {
  brand: {
    name_ar: string
    whatsapp: { number: string; url: string }
    logo: { url_path: string; width: number; height: number }
  }
  branches: {
    id: BranchId
    name_ar: string
    order_code_proposed: string
    address_ar: string
    phones: string[]
    maps_url: string
    timezone: string
    working_hours: WeeklyHours
    online_charges: { service_percent: number; tax_percent: number; tax_base: TaxBase | null }
    menu_file: string
    zones_file: string
  }[]
}

const raw = JSON.parse(branchesRaw) as RawBranches

export const brand: Brand = {
  name: raw.brand.name_ar,
  whatsappNumber: raw.brand.whatsapp.number,
  whatsappUrl: raw.brand.whatsapp.url,
  // Follows the deploy base path, so the logo also loads when the app is not served from "/".
  logoUrl: import.meta.env.BASE_URL + raw.brand.logo.url_path.replace(/^\//, ''),
  logoWidth: raw.brand.logo.width,
  logoHeight: raw.brand.logo.height,
}

export const branches: Branch[] = raw.branches.map((b) => ({
  id: b.id,
  code: b.order_code_proposed,
  name: b.name_ar,
  address: b.address_ar,
  phones: b.phones,
  mapsUrl: b.maps_url,
  timezone: b.timezone,
  hours: b.working_hours,
  charges: {
    service_percent: b.online_charges.service_percent,
    tax_percent: b.online_charges.tax_percent,
    tax_base: b.online_charges.tax_base,
  },
  menuFile: b.menu_file,
  zonesFile: b.zones_file,
}))

export function getBranch(id: string): Branch | undefined {
  return branches.find((b) => b.id === id)
}

// Item photos: any image in app/menu-images named after an item is used for it, in every
// menu and category that has an item with that name. No data file needs editing.
const imageFiles = import.meta.glob<string>('../../menu-images/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
/** Photo files by the comparison key of their name (without the extension). */
export const menuImages = new Map(
  Object.entries(imageFiles).map(([path, url]) => [imageKey(fileName(path).replace(/\.[^.]+$/, '')), { url, file: fileName(path) }]),
)

/** Rows of data/menu_extras.csv keyed by menu file, category and item. */
const menuExtras = new Map(parseCsv(menuExtrasRaw).map((row) => [`${row.menu_file}|${row.category}|${row.item}`, row]))
const isBadgeStyle = (value: string): value is BadgeStyle => value === 'a' || value === 'b' || value === 'c'

interface RawPromotions {
  hero: { badge?: string; title: string; description?: string; cta_label: string; branch_id?: BranchId; image?: string }[]
  menu_strip: { text: string; circle?: string; branches?: BranchId[] } | null
}
const promotions = JSON.parse(promotionsRaw) as RawPromotions

export const heroBanners: HeroBanner[] = promotions.hero.map((h) => ({
  badge: h.badge || undefined,
  title: h.title,
  description: h.description || undefined,
  ctaLabel: h.cta_label,
  branchId: h.branch_id,
  image: h.image ? import.meta.env.BASE_URL + h.image.replace(/^\//, '') : undefined,
}))

export function getMenuStrip(branchId: string): MenuStrip | null {
  const strip = promotions.menu_strip
  if (!strip) return null
  const only = strip.branches ?? []
  if (only.length > 0 && !only.some((b) => b === branchId)) return null
  return { text: strip.text, circle: strip.circle || undefined }
}

const MENU_SOURCES: Record<string, { prefix: string; text: string }> = {
  'menu_ashry_zagazig.csv': { prefix: 'w', text: menuWhiteRaw },
  'menu_tagamoa.csv': { prefix: 'b', text: menuBlackRaw },
}
const ZONE_SOURCES: Record<string, string> = {
  'delivery_zones_ashry.csv': zonesAshryRaw,
  'delivery_zones_zagazig.csv': zonesZagazigRaw,
  'delivery_zones_tagamoa.csv': zonesTagamoaRaw,
}

function buildMenu(file: string): MenuCategory[] {
  const source = MENU_SOURCES[file]
  if (!source) throw new Error(`unknown menu file ${file}`)
  const categories: MenuCategory[] = []
  const items = new Map<string, MenuItem>()
  for (const row of parseCsv(source.text)) {
    if (row.status === 'excluded') continue
    let category = categories.find((c) => c.name === row.category)
    if (!category) {
      category = { id: `${source.prefix}c${categories.length + 1}`, name: row.category, items: [] }
      categories.push(category)
    }
    const key = `${row.category}|${row.item}`
    let item = items.get(key)
    if (!item) {
      const extra = menuExtras.get(`${file}|${key}`)
      item = {
        id: `${source.prefix}${items.size + 1}`,
        category: row.category,
        name: row.item,
        description: row.description,
        sizes: [],
        advanceNoticeHours: row.advance_notice_hours ? Number(row.advance_notice_hours) : null,
        needsReview: false,
        image: menuImages.get(imageKey(row.item))?.url,
        badge: extra?.badge ? { text: extra.badge, style: isBadgeStyle(extra.badge_style) ? extra.badge_style : 'a' } : undefined,
      }
      items.set(key, item)
      category.items.push(item)
    }
    item.sizes.push({ id: `${item.id}-${item.sizes.length + 1}`, label: row.size_label, price: Number(row.price) })
    if (row.status === 'check') item.needsReview = true
  }
  return categories
}

const menuCache = new Map<string, MenuCategory[]>()

export function getMenu(branchId: string): MenuCategory[] {
  const branch = getBranch(branchId)
  if (!branch) return []
  if (!menuCache.has(branch.menuFile)) menuCache.set(branch.menuFile, buildMenu(branch.menuFile))
  return menuCache.get(branch.menuFile) ?? []
}

export function findSize(branchId: string, sizeId: string): { item: MenuItem; size: MenuSize } | undefined {
  for (const category of getMenu(branchId)) {
    for (const item of category.items) {
      const size = item.sizes.find((s) => s.id === sizeId)
      if (size) return { item, size }
    }
  }
  return undefined
}

/** Zones a customer can choose: one clear fee ("ok" or "review"). Pending zones stay hidden. */
export function getZones(branchId: string): DeliveryZone[] {
  const branch = getBranch(branchId)
  if (!branch) return []
  return parseCsv(ZONE_SOURCES[branch.zonesFile] ?? '')
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.status === 'ok' || row.status === 'review')
    .map(({ row, index }) => ({
      id: `${branch.id}-z${index + 1}`,
      type: row.zone_type,
      name: row.zone_name,
      label: zoneLabel(row.zone_type, row.zone_name),
      fee: Number(row.fee_min),
      needsReview: row.status === 'review',
    }))
}

/** Zones the owner still has to price (a range, two prices or a note in the branch file). */
export function getPendingZones(branchId: string): PendingZone[] {
  const branch = getBranch(branchId)
  if (!branch) return []
  return parseCsv(ZONE_SOURCES[branch.zonesFile] ?? '')
    .filter((row) => row.status === 'pending')
    .map((row) => ({
      type: row.zone_type,
      name: row.zone_name,
      label: zoneLabel(row.zone_type, row.zone_name),
      feeMin: Number(row.fee_min),
      feeMax: Number(row.fee_max),
      note: row.note,
    }))
}
