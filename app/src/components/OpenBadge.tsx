import type { Branch } from '@/lib/catalog'
import { DAY_NAMES_AR, formatTimeShort, getOpenStatus, zonedClock } from '@/lib/hours'
import { cn } from '@/lib/utils'

/** Branch status: green «مفتوح حتى 12 ليلاً» or beige «مغلق، يفتح 11 صباحاً», with a dot. */
export function OpenBadge({ branch, now, className }: { branch: Branch; now: Date; className?: string }) {
  const status = getOpenStatus(branch.hours, now, branch.timezone)
  let text: string
  if (status.isOpen) {
    text = `مفتوح حتى ${formatTimeShort(status.closesAt ?? '')}`
  } else if (status.opensAt && status.opensDay) {
    const today = zonedClock(now, branch.timezone).day
    const day = status.opensDay === today ? '' : `${DAY_NAMES_AR[status.opensDay]} `
    text = `مغلق، يفتح ${day}${formatTimeShort(status.opensAt)}`
  } else {
    text = 'مغلق الآن'
  }
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-4 font-bold whitespace-nowrap',
        status.isOpen ? 'bg-success-soft text-success-ink ring-1 ring-success/20' : 'bg-closed-soft text-closed-ink ring-1 ring-gold/30',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', status.isOpen ? 'bg-success ring-3 ring-success/20' : 'bg-badge-b ring-3 ring-badge-b/20')} aria-hidden="true" />
      {text}
    </span>
  )
}
