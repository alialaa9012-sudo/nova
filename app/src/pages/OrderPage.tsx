import { Banknote, Check, MessageCircle, Phone, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { BandHeader, BandSheet } from '@/components/BandHeader'
import { OrderNumberCard } from '@/components/OrderNumberCard'
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
  const card = 'grid gap-2.5 rounded-[22px] border border-border bg-card p-3.5 lg:p-4'
  return (
    <>
      <title>{`طلب ${order.number} | خليها مشاوي`}</title>
      <BandHeader backTo="/" backLabel="الصفحة الرئيسية" branchName={branch?.name} wide>
        <div className="mt-5 lg:flex lg:items-end lg:justify-between lg:gap-8">
          {navState?.justPlaced ? (
            <div role="status" className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-[#d8b57a] to-gold text-brand ring-[3px] ring-gold-hi/20" aria-hidden="true">
                <Check className="size-[18px] stroke-3" />
              </span>
              <div className="leading-tight">
                <h1 className="text-[19px] leading-7 font-extrabold lg:text-[28px] lg:leading-10">تم إرسال طلبك</h1>
                <p className="text-xs text-band-muted lg:text-[13px]">احتفظ برقم الطلب لمتابعته.</p>
              </div>
            </div>
          ) : (
            <h1 className="text-[22px] leading-8 font-extrabold lg:text-[28px] lg:leading-10">
              طلب رقم <span dir="ltr">{order.number}</span>
            </h1>
          )}
          <div className="lg:min-w-[300px]">
            <OrderNumberCard number={order.number} />
          </div>
        </div>
      </BandHeader>
      <BandSheet wide className="pb-10">
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
          <div className="grid gap-2.5">
            <section aria-labelledby="status-title" className={card}>
              <h2 id="status-title" className="text-[15px] font-extrabold">
                حالة الطلب
              </h2>
              <StatusTimeline order={order} horizontal />
            </section>

            <section aria-labelledby="details-title" className={card}>
              <h2 id="details-title" className="text-[15px] font-extrabold">
                تفاصيل الطلب
              </h2>
              <p className="text-[12.5px] text-muted-foreground">
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
              <p className="flex items-center gap-2 text-sm font-extrabold text-success-ink">
                <Banknote className="size-5" aria-hidden="true" /> الدفع كاش عند الاستلام
              </p>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:sticky lg:top-5">
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
            {branch ? (
              <Button asChild className="col-span-2 h-12">
                <Link to={`/branch/${branch.id}`}>
                  <RotateCcw aria-hidden="true" /> اطلب مرة أخرى
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </BandSheet>
    </>
  )
}
