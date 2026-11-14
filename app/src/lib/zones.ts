// Helpers shared by the zone admin screen and the backends.
import { toAsciiDigits } from './phone'
import { searchKey } from './text'

export const DEFAULT_ZONE_TYPE = 'منطقة'
export const MAX_ZONE_NAME = 60
export const MAX_ZONE_FEE = 5000

/** "مجاورة 12" for typed zones, the bare name for plain areas. */
export function zoneLabel(type: string, name: string): string {
  return type === DEFAULT_ZONE_TYPE ? name : `${type} ${name}`
}

/** Tidies a zone name typed by staff: single spaces, and ASCII digits like the branch lists use. */
export function cleanZoneName(name: string): string {
  return toAsciiDigits(name).replace(/\s+/g, ' ').trim()
}

/** Comparison key that treats spelling variants as the same zone (see searchKey). */
export const zoneKey = searchKey

/** Whole pounds from 0 to MAX_ZONE_FEE, typed with Arabic or ASCII digits; null when not valid. */
export function parseZoneFee(text: string): number | null {
  const digits = toAsciiDigits(text).trim()
  if (!/^\d{1,4}$/.test(digits)) return null
  const fee = Number(digits)
  return fee <= MAX_ZONE_FEE ? fee : null
}
