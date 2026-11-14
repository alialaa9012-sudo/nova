import { Link, useLocation } from 'react-router'
import { api } from '@/lib/api'

export function DemoBanner() {
  const onBoard = useLocation().pathname.startsWith('/admin')
  if (api.mode !== 'local') return null
  return (
    <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      نسخة تجريبية: الطلبات تُحفظ على هذا الجهاز فقط ولا تصل إلى المطعم بعد.{' '}
      {/* The demo has no staff login yet, so the banner is the way to move between the two sides. */}
      <Link to={onBoard ? '/' : '/admin'} className="underline underline-offset-2">
        {onBoard ? 'واجهة العميل' : 'لوحة الكول سنتر'}
      </Link>
    </div>
  )
}
