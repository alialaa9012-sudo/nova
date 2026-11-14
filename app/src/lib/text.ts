import { toAsciiDigits } from './phone'

/**
 * Comparison key for Arabic names typed or filed by people: ignores composed/decomposed
 * forms, Arabic vs ASCII digits, tatweel, alef and hamza variants, ta marbuta/ha,
 * alef maqsura/ya, letter case and extra spacing.
 */
export function searchKey(text: string): string {
  return toAsciiDigits(text.normalize('NFKC'))
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Key for matching a photo file name to an item name: letters and digits only. */
export function imageKey(name: string): string {
  return searchKey(name).replace(/[^\p{L}\p{N}]/gu, '')
}
