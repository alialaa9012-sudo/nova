// Helpers shared by the zone admin screen and the backends.
import { toAsciiDigits } from './phone'

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

/**
 * Comparison key that treats spelling variants as the same zone:
 * Arabic or ASCII digits, alef forms, ta marbuta/ha, alef maqsura/ya, tatweel, spacing.
 */
export function zoneKey(label: string): string {
  return toAsciiDigits(label)
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Whole pounds from 0 to MAX_ZONE_FEE, typed with Arabic or ASCII digits; null when not valid. */
export function parseZoneFee(text: string): number | null {
  const digits = toAsciiDigits(text).trim()
  if (!/^\d{1,4}$/.test(digits)) return null
  const fee = Number(digits)
  return fee <= MAX_ZONE_FEE ? fee : null
}
