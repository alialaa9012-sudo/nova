import { useNavigate } from 'react-router'
import { BandHeader, BandSheet } from '@/components/BandHeader'
import { BottomNav } from '@/components/BottomNav'
import { TrackForm } from '@/components/TrackForm'

export function TrackPage() {
  const navigate = useNavigate()
  return (
    <>
      <title>تتبع طلبك | خليها مشاوي</title>
      <BandHeader backTo="/" backLabel="الصفحة الرئيسية">
        <h1 className="mt-6 text-[28px] leading-10 font-extrabold lg:text-[32px] lg:leading-[44px]">تتبع طلبك</h1>
        <p className="mt-1 text-sm leading-[22px] text-band-muted">اكتب رقم الطلب ورقم الموبايل الذي طلبت به.</p>
      </BandHeader>
      <BandSheet className="pt-4 pb-28 lg:pb-12">
        <TrackForm onDone={(number, phone) => navigate(`/order/${number}`, { state: { phone } })} />
      </BandSheet>
      <BottomNav />
    </>
  )
}
