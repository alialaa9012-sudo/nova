import { useNavigate } from 'react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { TrackForm } from '@/components/TrackForm'

export function TrackPage() {
  const navigate = useNavigate()
  return (
    <>
      <title>تتبع طلبك | خليها مشاوي</title>
      <SiteHeader backTo="/" backLabel="الصفحة الرئيسية" title="تتبع طلبك" />
      <main className="mx-auto grid max-w-md gap-4 px-4 py-8">
        <h1 className="text-2xl font-extrabold">تتبع طلبك</h1>
        <p className="text-muted-foreground">اكتب رقم الطلب ورقم الموبايل الذي طلبت به.</p>
        <TrackForm onDone={(number, phone) => navigate(`/order/${number}`, { state: { phone } })} />
      </main>
    </>
  )
}
