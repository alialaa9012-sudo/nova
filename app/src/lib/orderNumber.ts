/**
 * Order numbers: each branch counts from 01 every day, shown as #01 (the owner's choice, 20 Nov 2026).
 * The number is stored without «#» so it reads the same in a link. Older orders keep A-0001.
 */
export function orderLabel(number: string): string {
  return /^\d+$/.test(number) ? `#${number}` : number
}

/**
 * What a person typed as an order number, ready to look up: no «#», no spaces, upper case, and
 * digits written as stored (two at least), so «1», «#1» and «001» all find #01.
 */
export function cleanOrderNumber(typed: string): string {
  const n = typed.replace(/[#\s]/g, '').toUpperCase()
  return /^\d+$/.test(n) ? String(Number(n)).padStart(2, '0') : n
}
