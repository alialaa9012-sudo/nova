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

/**
 * Words people use for the same thing. A search word from one group also finds names written with
 * another (someone typing «دجاج» finds «صدور فراخ» and «فرخة مشوية»). Compared after searchKey.
 */
const SYNONYMS: string[][] = [
  ['فراخ', 'فرخه', 'دجاج', 'فرخ'],
  ['لحمه', 'لحم'],
  ['ارز', 'رز'],
  ['بطاطس', 'بطاطا', 'فرايز'],
  ['شوربه', 'شوربا'],
  ['عيش', 'خبز'],
  ['بيبسي', 'كولا', 'مشروب غازي', 'غازيه'],
  ['مياه', 'ميه', 'ماء'],
  ['ضاني', 'خروف', 'غنم'],
  ['بتلو', 'عجل'],
  ['سلطه', 'سلاطه'],
].map((group) => group.map(searchKey))

/** True when every word of the query appears in the name, directly or through a synonym. */
export function matchesSearch(name: string, query: string): boolean {
  const target = searchKey(name)
  const words = searchKey(query).split(' ').filter(Boolean)
  return words.every((word) => {
    if (target.includes(word)) return true
    const group = SYNONYMS.find((g) => g.some((alt) => alt === word || (word.length > 2 && alt.startsWith(word))))
    return !!group && group.some((alt) => target.includes(alt))
  })
}
