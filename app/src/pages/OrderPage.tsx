import { Banknote, MessageCircle, Phone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { OrderSummary } from '@/components/OrderSummary'
import { SiteHeader } from '@/components/SiteHeader'
import { StatusTimeline } from '@/components/StatusTimeline'
import { TrackForm } from '@/components/TrackForm'
import { Button } from '@/components/ui/button'
import { api, type Order } from '@/lib/api'
import { brand, getBranch } from '@/lib/catalog'
import { formatCairoDateTime } from '@/lib/format'
import { lastOrder } from '@/lib/lastOrder'

export function OrderPage() {
  const { number = '' } = useParams()
  const location = useLocation()
  const navState = location.state as { phone?: string; justPlaced?: boolean } | null
  const remembered = lastOrder()
  const [phone, setPhone] = useState(navState?.phone ?? (remembered?.number === number ? remembered.phone : undefined))
  const [order, setOrder] = useState<Order | null | undefined>(undefined)

  useEffect(() => {
    if (!phone) return
    let alive = true
    const load = async () => {
      const found = await api.trackOrder(number, phone)
      if (alive) setOrder(found)
    }
    void load()
    const stop = api.subscribe(() => void load())
    const timer = setInterval(() => void load(), 30_000)
    return () => {
      alive = false
      stop()
      clearInterval(timer)
    }
  }, [number, phone])

  const header = <SiteHeader narrow backTo="/" backLabel="الصفحة الرئيسية" title={`طلب ${number}`} />

  if (!phone) {
    return (
      <>
        <title>{`طلب ${number} | خليها مشاوي`}</title>
        {header}
        <main className="mx-auto grid max-w-md gap-4 px-5 py-8">
          <h1 className="text-2xl font-extrabold">
            طلب رقم <span dir="ltr">{number}</span>
          </h1>
          <p className="text-muted-foreground">اكتب رقم الموبايل الذي طلبت به لعرض حالة الطلب.</p>
          <TrackForm fixedNumber={number} onDone={(_n, p) => setPhone(p)} />
        </main>
      </>
    )
  }

  if (order === undefined) {
    return (
      <>
        {header}
        <main className="mx-auto max-w-3xl px-4 py-12 text-center" aria-busy="true">
          <h1 className="text-xl font-bold">جاري تحميل الطلب…</h1>
        </main>
      </>
    )
  }

  if (order === null) {
    return (
      <>
        <title>الطلب غير موجود | خليها مشاوي</title>
        {header}
        <main className="mx-auto grid max-w-md gap-4 px-5 py-8 text-center">
          <h1 className="text-2xl font-bold">لم نجد هذا الطلب</h1>
          <p className="text-muted-foreground">تأكد من رقم الطلب ورقم الموبايل. التتبع متاح لطلبات آخر 3 أيام.</p>
          <Button asChild size="lg" className="mx-auto">
            <Link to="/track">تتبع طلب آخر</Link>
          </Button>
        </main>
      </>
    )
  }

  const branch = getBranch(order.branchId)
  return (
    <>
      <title>{`طلب ${order.number} | خليها مشاوي`}</title>
      {header}
      <main className="mx-auto grid max-w-3xl gap-4 px-5 pt-2 pb-8">
        {navState?.justPlaced ? (
          <div role="status" className="rounded-[20px] bg-emerald-50 p-4 text-emerald-950">
            <h1 className="text-[22px] leading-[30px] font-extrabold">تم إرسال طلبك</h1>
            <p className="mt-1">
              رقم طلبك <strong dir="ltr">{order.number}</strong>. احتفظ به لمتابعة الطلب.
            </p>
          </div>
        ) : (
          <h1 className="text-[26px] leading-9 font-extrabold">
            طلب رقم <span dir="ltr">{order.number}</span>
          </h1>
        )}

        <section aria-labelledby="status-title" className="grid gap-3 rounded-[20px] bg-card p-4 shadow-card">
          <h2 id="status-title" className="font-bold">
            حالة الطلب
          </h2>
          <StatusTimeline order={order} />
        </section>

        <section aria-labelledby="details-title" className="grid gap-3 rounded-[20px] bg-card p-4 shadow-card">
          <h2 id="details-title" className="font-bold">
            تفاصيل الطلب
          </h2>
          <p className="text-sm">
            فرع {branch?.name} · {order.orderType === 'delivery' ? 'توصيل' : 'استلام من الفرع'} · {formatCairoDateTime(order.createdAt)}
          </p>
          {order.orderType === 'delivery' ? (
            <p className="text-sm">
              العنوان: {[order.zoneLabel, order.street, order.building && `عمارة ${order.building}`, order.apartment && `شقة ${order.apartment}`]
                .filter(Boolean)
                .join('، ')}
            </p>
          ) : (
            <p className="text-sm">الاستلام من: {branch?.address}</p>
          )}
          <OrderSummary
            lines={order.lines.map((l, i) => ({ key: String(i), ...l }))}
            totals={order.totals}
            orderType={order.orderType}
            taxPercent={branch?.charges.tax_percent ?? 0}
            servicePercent={branch?.charges.service_percent ?? 0}
          />
          <p className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-tint px-3 text-sm font-semibold">
            <Banknote className="size-5" aria-hidden="true" /> الدفع كاش عند الاستلام
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {branch ? (
            <Button asChild className="h-12 min-w-40 flex-1">
              <Link to={`/branch/${branch.id}`}>اطلب مرة أخرى</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="h-12">
            <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" /> واتساب
            </a>
          </Button>
          {branch ? (
            <Button asChild variant="outline" className="h-12">
              <a href={`tel:${branch.phones[0]}`}>
                <Phone aria-hidden="true" /> اتصل بالفرع
              </a>
            </Button>
          ) : null}
        </div>
      </main>
    </>
  )
}
