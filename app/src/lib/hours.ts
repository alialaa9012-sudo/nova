// Opening hours in the branch's own time zone. A day "crosses midnight" when it closes
// on the following calendar day (e.g. Thursday 11:00 -> Friday 01:00).
export type DayKey = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

export interface DayHours {
  opens: string
  closes: string
  crosses_midnight: boolean
}

export type WeeklyHours = Record<DayKey, DayHours>

export const WEEK_ORDER: DayKey[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']

export const DAY_NAMES_AR: Record<DayKey, string> = {
  sat: 'السبت',
  sun: 'الأحد',
  mon: 'الاثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
  fri: 'الجمعة',
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Weekday and minutes since local midnight of `date` in `timeZone`. */
export function zonedClock(date: Date, timeZone: string): { day: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = get('weekday').toLowerCase().slice(0, 3) as DayKey
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export interface OpenStatus {
  isOpen: boolean
  /** Closing time of the current window when open. */
  closesAt?: string
  /** Next opening when closed. */
  opensAt?: string
  opensDay?: DayKey
}

export function getOpenStatus(hours: WeeklyHours, date: Date, timeZone = 'Africa/Cairo'): OpenStatus {
  const { day, minutes } = zonedClock(date, timeZone)
  const idx = WEEK_ORDER.indexOf(day)

  const prev = hours[WEEK_ORDER[(idx + 6) % 7]]
  if (prev?.crosses_midnight && minutes < toMinutes(prev.closes)) {
    return { isOpen: true, closesAt: prev.closes }
  }

  const today = hours[day]
  if (today) {
    const opens = toMinutes(today.opens)
    const closes = toMinutes(today.closes)
    const open = today.crosses_midnight ? minutes >= opens : minutes >= opens && minutes < closes
    if (open) return { isOpen: true, closesAt: today.closes }
    if (minutes < opens) return { isOpen: false, opensAt: today.opens, opensDay: day }
  }

  for (let k = 1; k <= 7; k++) {
    const next = WEEK_ORDER[(idx + k) % 7]
    if (hours[next]) return { isOpen: false, opensAt: hours[next].opens, opensDay: next }
  }
  return { isOpen: false }
}

/** "11:00" -> "11 صباحاً", "00:00" -> "12 منتصف الليل", "01:00" -> "1 بعد منتصف الليل". */
export function formatTimeAr(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const mm = m ? `:${String(m).padStart(2, '0')}` : ''
  if (h === 0 && m === 0) return '12 منتصف الليل'
  if (h === 0) return `12${mm} بعد منتصف الليل`
  if (h <= 4) return `${h}${mm} بعد منتصف الليل`
  if (h <= 11) return `${h}${mm} صباحاً`
  if (h === 12) return `12${mm} ظهراً`
  return `${h - 12}${mm} مساءً`
}

/** Groups consecutive days with identical hours: [{ days: 'السبت إلى الأربعاء', text: 'من 11 صباحاً إلى 12 منتصف الليل' }]. */
export function summarizeHours(hours: WeeklyHours): { days: string; text: string }[] {
  const groups: { keys: DayKey[]; sig: string }[] = []
  for (const key of WEEK_ORDER) {
    const h = hours[key]
    const sig = `${h.opens}-${h.closes}`
    const last = groups[groups.length - 1]
    if (last && last.sig === sig) last.keys.push(key)
    else groups.push({ keys: [key], sig })
  }
  return groups.map(({ keys }) => {
    const names = keys.map((k) => DAY_NAMES_AR[k])
    const days =
      names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} و${names[1]}` : `${names[0]} إلى ${names[names.length - 1]}`
    const h = hours[keys[0]]
    return { days, text: `من ${formatTimeAr(h.opens)} إلى ${formatTimeAr(h.closes)}` }
  })
}
