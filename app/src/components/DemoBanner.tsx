import { Link, useLocation } from 'react-router'
import { api } from '@/lib/api'

// The Artifact preview has no address bar, so its banner is the only way to reach the staff
// board. On the real site customers never see that link; staff open /admin directly.
const SHOW_BOARD_LINK = import.meta.env.MODE === 'artifact'

export function DemoBanner() {
  const onBoard = useLocation().pathname.startsWith('/admin')
  if (api.mode !== 'local') return null
  return (
    <aside aria-label="تنبيه" className="bg-band px-4 py-1.5 text-center text-xs leading-[18px] font-semibold text-band-ink">
      نسخة تجريبية: الطلبات لا تصل إلى المطعم بعد.
      {SHOW_BOARD_LINK ? (
        <>
          {' '}
          <Link to={onBoard ? '/' : '/admin'} className="text-gold-hi underline underline-offset-2">
            {onBoard ? 'واجهة العميل' : 'لوحة الكول سنتر'}
          </Link>
        </>
      ) : null}
    </aside>
  )
}
