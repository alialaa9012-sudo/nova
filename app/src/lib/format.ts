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

const longDate = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** "2027-01-04" -> "الاثنين، 4 يناير 2027": the date picker shows the browser's own format, this one cannot be misread. */
export function formatDateAr(ymd: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? longDate.format(new Date(`${ymd}T00:00:00Z`)) : ''
}

/** Calendar date (YYYY-MM-DD) of an instant in Cairo. */
export function cairoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(date)
}

const time = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' })

/** Clock time in Cairo, e.g. "1:45 م". */
export function formatCairoTime(iso: string): string {
  return time.format(new Date(iso))
}
