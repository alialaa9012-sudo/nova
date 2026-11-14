import { useNavigate } from 'react-router'
import { BottomNav } from '@/components/BottomNav'
import { SiteHeader } from '@/components/SiteHeader'
import { TrackForm } from '@/components/TrackForm'

export function TrackPage() {
  const navigate = useNavigate()
  return (
    <>
      <title>تتبع طلبك | خليها مشاوي</title>
      <SiteHeader narrow backTo="/" backLabel="الصفحة الرئيسية" title="تتبع طلبك" />
      <main className="mx-auto grid max-w-md gap-4 px-5 pt-2 pb-28 lg:pb-8">
        <h1 className="text-[26px] leading-9 font-extrabold">تتبع طلبك</h1>
        <p className="text-sm leading-[22px] text-muted-foreground">اكتب رقم الطلب ورقم الموبايل الذي طلبت به.</p>
        <div className="rounded-[20px] bg-card p-4 shadow-card">
          <TrackForm onDone={(number, phone) => navigate(`/order/${number}`, { state: { phone } })} />
        </div>
      </main>
      <BottomNav />
    </>
  )
}
