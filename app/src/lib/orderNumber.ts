/**
 * Order numbers: each branch counts from 01 every day, shown as #01 (the owner's choice, 20 Nov 2026).
 * The number is stored without «#» so it reads the same in a link. Older orders keep A-0001.
 */
export function orderLabel(number: string): string {
  return /^\d+$/.test(number) ? `#${number}` : number
}

/** What a person typed as an order number, ready to look up: no «#», no spaces, upper case. */
export function cleanOrderNumber(typed: string): string {
  return typed.replace(/[#\s]/g, '').toUpperCase()
}
