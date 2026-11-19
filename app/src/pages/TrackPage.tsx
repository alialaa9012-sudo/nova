import { useNavigate } from 'react-router'
import { BandHeader, BandSheet } from '@/components/BandHeader'
import { BottomNav } from '@/components/BottomNav'
import { TrackForm } from '@/components/TrackForm'
import { api } from '@/lib/api'

export function TrackPage() {
  const navigate = useNavigate()
  return (
    <>
      <title>تتبع طلبك | خليها مشاوي</title>
      <BandHeader backTo="/" backLabel="الصفحة الرئيسية">
        <h1 className="mt-6 text-[28px] leading-10 font-extrabold lg:text-[32px] lg:leading-[44px]">تتبع طلبك</h1>
        <p className="mt-1 text-sm leading-[22px] text-band-muted">اكتب رقم الطلب أو رقم الموبايل الذي طلبت به.</p>
      </BandHeader>
      <BandSheet className="pt-4 pb-28 lg:pb-12">
        <TrackForm
          onDone={async (query) => {
            const order = await api.trackOrder(query.number ?? null, query.phone ?? null).catch(() => null)
            if (!order) {
              return query.phone
                ? 'لم نجد طلباً بهذا الرقم خلال آخر 3 أيام.'
                : 'لم نجد طلباً بهذا الرقم اليوم. لطلب أقدم ابحث برقم الموبايل.'
            }
            navigate(`/order/${order.number}`, { state: { phone: query.phone } })
            return null
          }}
        />
      </BandSheet>
      <BottomNav />
    </>
  )
}
