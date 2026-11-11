const money = new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 2 })

/** 170 -> "170 ج.م" with Latin digits, as printed on the menus. */
export function formatEGP(value: number): string {
  return `${money.format(value)} ج.م`
}

const dateTime = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatCairoDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

/** Calendar date (YYYY-MM-DD) of an instant in Cairo. */
export function cairoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(date)
}
