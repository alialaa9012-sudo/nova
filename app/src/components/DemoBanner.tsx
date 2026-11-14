import { Link, useLocation } from 'react-router'
import { api } from '@/lib/api'

// The Artifact preview has no address bar, so its banner is the only way to reach the staff
// board. On the real site customers never see that link; staff open /admin directly.
const SHOW_BOARD_LINK = import.meta.env.MODE === 'artifact'

export function DemoBanner() {
  const onBoard = useLocation().pathname.startsWith('/admin')
  if (api.mode !== 'local') return null
  return (
    <div role="note" className="bg-amber-100 px-4 py-1.5 text-center text-xs leading-[18px] font-semibold text-amber-950">
      نسخة تجريبية: الطلبات تُحفظ على هذا الجهاز فقط ولا تصل إلى المطعم بعد.
      {SHOW_BOARD_LINK ? (
        <>
          {' '}
          <Link to={onBoard ? '/' : '/admin'} className="underline underline-offset-2">
            {onBoard ? 'واجهة العميل' : 'لوحة الكول سنتر'}
          </Link>
        </>
      ) : null}
    </div>
  )
}
