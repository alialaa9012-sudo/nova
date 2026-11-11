import { Clock } from 'lucide-react'
import type { Branch } from '@/lib/catalog'
import { DAY_NAMES_AR, formatTimeAr, getOpenStatus, zonedClock } from '@/lib/hours'
import { cn } from '@/lib/utils'

export function OpenBadge({ branch, now, className }: { branch: Branch; now: Date; className?: string }) {
  const status = getOpenStatus(branch.hours, now, branch.timezone)
  let text: string
  if (status.isOpen) {
    text = `مفتوح الآن حتى ${formatTimeAr(status.closesAt ?? '')}`
  } else if (status.opensAt && status.opensDay) {
    const today = zonedClock(now, branch.timezone).day
    const day = status.opensDay === today ? '' : `${DAY_NAMES_AR[status.opensDay]} `
    text = `مغلق الآن، يفتح ${day}${formatTimeAr(status.opensAt)}`
  } else {
    text = 'مغلق الآن'
  }
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
        status.isOpen ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-200 text-stone-900',
        className,
      )}
    >
      <Clock className="size-4" aria-hidden="true" />
      {text}
    </span>
  )
}
