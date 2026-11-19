import { Banknote, Check, MessageCircle, Phone, RotateCcw, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { BandHeader, BandSheet } from '@/components/BandHeader'
import { OrderNumberCard } from '@/components/OrderNumberCard'
import { OrderSummary } from '@/components/OrderSummary'
import { StatusTimeline } from '@/components/StatusTimeline'
import { TrackForm } from '@/components/TrackForm'
import { Button } from '@/components/ui/button'
import { api, type Order } from '@/lib/api'
import { branches, brand, getBranch } from '@/lib/catalog'
import { formatCairoTime } from '@/lib/format'
import { PREP_MINUTES } from '@/lib/orderStatus'
import { cartReducer } from '@/lib/cart'
import { lastOrder } from '@/lib/lastOrder'
import { reorderLines } from '@/lib/reorder'
import { loadCart, saveCart } from '@/state/cart-context'
import { cn } from '@/lib/utils'
import { orderLabel } from '@/lib/orderNumber'

export function OrderPage() {
  const { number = '' } = useParams()
  const navigate = useNavigate()
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
    // The customer gets no push, so the status is re-read every 15 seconds while the page is open.
    const stop = api.subscribe(() => void load(), { pollMs: 15_000 })
    return () => {
      alive = false
      stop()
    }
  }, [number, phone])

  /** The dark band with the page's own title and line, for the states before the order shows. */
  const band = (title: ReactNode, line?: string) => (
    <BandHeader backTo="/" backLabel="الصفحة الرئيسية">
      <h1 className="mt-6 text-[26px] leading-9 font-extrabold lg:text-[32px] lg:leading-[44px]">{title}</h1>
      {line ? <p className="mt-1 text-sm leading-[22px] text-band-muted">{line}</p> : null}
    </BandHeader>
  )

  if (!phone) {
    return (
      <>
        <title>{`طلب ${orderLabel(number)} | خليها مشاوي`}</title>
        {band(
          <>
            طلب رقم <span dir="ltr">{orderLabel(number)}</span>
          </>,
          'اكتب رقم الموبايل الذي طلبت به لعرض حالة الطلب.',
        )}
        <BandSheet className="pt-4 pb-12">
          <TrackForm fixedNumber={number} onDone={(_n, p) => setPhone(p)} />
        </BandSheet>
      </>
    )
  }

  if (order === undefined) {
    return (
      <>
        {band(
          <>
            طلب رقم <span dir="ltr">{orderLabel(number)}</span>
          </>,
        )}
        <BandSheet className="pt-8 pb-12 text-center" >
          <p aria-busy="true" className="text-[15px] font-bold text-muted-foreground">
            جاري تحميل الطلب…
          </p>
        </BandSheet>
      </>
    )
  }

  if (order === null) {
    const numberBranch = branches.find((b) => number.toUpperCase().startsWith(`${b.code}-`))
    return (
      <>
        <title>الطلب غير موجود | خليها مشاوي</title>
        {band('لم نجد هذا الطلب', 'تأكد من رقم الطلب ورقم الموبايل. التتبع متاح لطلبات آخر 3 أيام.')}
        <BandSheet className="grid gap-2 pt-5 pb-12">
          <Button asChild size="lg" className="h-14 w-full text-base">
            <Link to="/track">
              <Search aria-hidden="true" /> تتبع طلب آخر
            </Link>
          </Button>
          {/* Still stuck: reach the restaurant. The letter of the number names the branch (A-0012 is Ashry). */}
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className={cn('h-12', !numberBranch && 'col-span-2')}>
              <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" /> واتساب
              </a>
            </Button>
            {numberBranch ? (
              <Button asChild variant="outline" className="h-12">
                <a href={`tel:${numberBranch.phones[0]}`}>
                  <Phone aria-hidden="true" /> اتصل بالفرع
                </a>
              </Button>
            ) : null}
          </div>
        </BandSheet>
      </>
    )
  }

  const branch = getBranch(order.branchId)
  // Puts the same items back in this branch's cart (today's prices) and opens the cart there.
  function reorder(branchId: NonNullable<typeof branch>['id']) {
    if (!order) return
    const { lines, missing } = reorderLines(branchId, order)
    const merged = lines.reduce((cart, l) => cartReducer(cart, { type: 'add', line: { ...l }, qty: l.qty }), loadCart(branchId))
    saveCart(branchId, merged)
    navigate(`/branch/${branchId}`, { state: { reordered: { added: lines.length, missing } } })
  }
  const card = 'grid gap-2.5 rounded-[22px] border border-border bg-card p-3.5 lg:p-4'
  return (
    <>
      <title>{`طلب ${orderLabel(order.number)} | خليها مشاوي`}</title>
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
              طلب رقم <span dir="ltr">{orderLabel(order.number)}</span>
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
              <ExpectedTime order={order} />
            </section>

            <section aria-labelledby="details-title" className={card}>
              <h2 id="details-title" className="text-[15px] font-extrabold">
                تفاصيل الطلب
              </h2>
              {/* Kept short on purpose (owner, 20 Nov 2026): branch and type only, no address or times. */}
              <p className="text-[12.5px] text-muted-foreground">
                فرع {branch?.name} · {order.orderType === 'delivery' ? 'توصيل' : 'استلام من الفرع'}
              </p>
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
              <Button className="col-span-2 h-12" onClick={() => reorder(branch.id)}>
                <RotateCcw aria-hidden="true" /> اطلب مرة أخرى
              </Button>
            ) : null}
          </div>
        </div>
      </BandSheet>
    </>
  )
}

/** When the customer can expect the order: the agreed window before acceptance, the clock time after. */
function ExpectedTime({ order }: { order: Order }) {
  const pickup = order.orderType === 'pickup'
  const [from, by] = PREP_MINUTES[order.orderType]
  let text: string | null = null
  if (order.status === 'new') {
    text = pickup ? `بعد قبول الطلب يكون جاهزاً للاستلام خلال ${from} إلى ${by} دقيقة.` : `بعد قبول الطلب يخرج للتوصيل خلال ${by} دقيقة.`
  } else if (order.status === 'preparing' && order.readyBy) {
    text = pickup && order.readyFrom
      ? `الوقت المتوقع: جاهز للاستلام من ${formatCairoTime(order.readyFrom)} إلى ${formatCairoTime(order.readyBy)}.`
      : `الوقت المتوقع لخروج الطلب للتوصيل: ${formatCairoTime(order.readyBy)}.`
  }
  return text ? <p className="rounded-xl bg-gold-soft px-3 py-2 text-[13px] font-bold text-[#5a4026] ring-1 ring-gold/40">{text}</p> : null
}
