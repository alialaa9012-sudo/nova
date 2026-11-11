import { api } from '@/lib/api'

export function DemoBanner() {
  if (api.mode !== 'local') return null
  return (
    <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      نسخة تجريبية: الطلبات تُحفظ على هذا الجهاز فقط ولا تصل إلى المطعم بعد.
    </div>
  )
}
