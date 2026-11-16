import { Banknote, Bike, Building2, DoorOpen, Landmark, MapPin, Navigation, NotebookPen, Phone, Store, User } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { BandHeader, BandSheet } from '@/components/BandHeader'
import { fieldGroup, groupTitle, rowInput } from '@/components/form-styles'
import { IconField } from '@/components/IconField'
import { OrderSummary } from '@/components/OrderSummary'
import { ZoneCombobox } from '@/components/ZoneCombobox'
import { Button } from '@/components/ui/button'
import { RadioGroup } from 'radix-ui'
import { useNow } from '@/hooks/useNow'
import { fieldProps } from '@/lib/a11y'
import { api, errorMessage } from '@/lib/api'
import type { DeliveryZone } from '@/lib/catalog'
import { lineKey } from '@/lib/cart'
import { validateCheckout, type CheckoutErrors, type CheckoutForm } from '@/lib/checkout'
import { clearDraft, loadDraft, saveDraft } from '@/lib/checkoutDraft'
import { formatEGP } from '@/lib/format'
import { formatTimeAr, getOpenStatus } from '@/lib/hours'
import { rememberOrder } from '@/lib/lastOrder'
import { computeTotals, type OrderType } from '@/lib/pricing'
import { useBranch } from '@/state/branch-context'
import { useCart } from '@/state/cart-context'
import { cn } from '@/lib/utils'

const ORDER_TYPES = [
  { value: 'delivery', label: 'توصيل للعنوان', icon: Bike },
  { value: 'pickup', label: 'استلام من الفرع', icon: Store },
] as const
const card = 'grid rounded-[22px] border border-border bg-card p-4'
const newClientRef = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))

export function CheckoutPage() {
  const branch = useBranch()
  const navigate = useNavigate()
  const now = useNow()
  const { lines, dispatch } = useCart()
  const [zones, setZones] = useState<DeliveryZone[]>([])
  useEffect(() => {
    let alive = true
    const load = async () => {
      const list = await api.listZones(branch.id)
      if (alive) setZones(list)
    }
    void load()
    const stop = api.subscribe(() => void load())
    return () => {
      alive = false
      stop()
    }
  }, [branch.id])
  const [form, setForm] = useState<CheckoutForm>(() => loadDraft(branch.id))
  const [zoneOpen, setZoneOpen] = useState(false)
  useEffect(() => saveDraft(branch.id, form), [branch.id, form])
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [submitting, setSubmitting] = useState(false)
  // Set before the first await, so taps that land before React redraws the disabled button are ignored.
  const inFlight = useRef(false)
  // One id for this checkout: if the same order is sent twice, the backend returns the first one.
  const [clientRef] = useState(newClientRef)
  const [serverError, setServerError] = useState<string | null>(null)

  // A remembered zone that no longer exists (removed by the admin) simply counts as not chosen.
  const zone = zones.find((z) => z.id === form.zoneId)
  const zoneId = zone ? zone.id : ''
  const totals = computeTotals(lines, form.orderType, zone?.fee ?? 0, branch.charges)
  const status = getOpenStatus(branch.hours, now, branch.timezone)
  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    // A corrected field drops its message right away instead of staying red until the next submit.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }
  const menuPath = `/branch/${branch.id}`

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const found = validateCheckout({ ...form, zoneId })
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      document.getElementById(first)?.focus()
      return
    }
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setServerError(null)
    try {
      const order = await api.placeOrder({
        branchId: branch.id,
        orderType: form.orderType,
        customerName: form.name,
        phone: form.phone,
        zoneId: form.orderType === 'delivery' ? zoneId : undefined,
        street: form.street,
        building: form.building,
        apartment: form.apartment,
        landmark: form.landmark,
        notes: form.notes,
        clientRef,
        lines: lines.map((l) => ({ sizeId: l.sizeId, qty: l.qty, note: l.note })),
      })
      dispatch({ type: 'clear' })
      clearDraft(branch.id)
      rememberOrder(order.number, order.phone)
      navigate(`/order/${order.number}`, { state: { phone: order.phone, justPlaced: true } })
    } catch (err) {
      setServerError(errorMessage(err))
      setSubmitting(false)
      inFlight.current = false
    }
  }

  if (lines.length === 0) {
    return (
      <>
        <title>إتمام الطلب | خليها مشاوي</title>
        <BandHeader backTo={menuPath} backLabel="رجوع للمنيو" branchName={branch.name}>
          <h1 className="mt-6 text-[26px] leading-9 font-extrabold lg:text-[32px] lg:leading-[44px]">السلة فارغة</h1>
          <p className="mt-1 text-sm leading-[22px] text-band-muted">أضف أصنافاً من المنيو أولاً.</p>
        </BandHeader>
        <BandSheet className="pt-5 pb-12">
          <Button asChild size="lg" className="h-14 w-full text-base">
            <Link to={menuPath}>العودة للمنيو</Link>
          </Button>
        </BandSheet>
      </>
    )
  }

  const blocked = !status.isOpen || Boolean(serverError)
  return (
    <>
      <title>{`إتمام الطلب · فرع ${branch.name} | خليها مشاوي`}</title>
      <BandHeader backTo={menuPath} backLabel="رجوع للمنيو" branchName={branch.name} wide>
        <div className="mt-4 flex items-end justify-between gap-4 lg:mt-6">
          <h1 className="text-[26px] leading-9 font-extrabold lg:text-[32px] lg:leading-[44px]">إتمام الطلب</h1>
          <p className="grid text-end leading-tight">
            <span className="text-xs text-band-muted lg:text-[13px]">الإجمالي · الدفع كاش عند الاستلام</span>
            <span className="text-[26px] leading-9 font-extrabold text-gold-hi tabular-nums lg:text-[30px]">{formatEGP(totals.total)}</span>
          </p>
        </div>
        {/* Delivery or pickup: each segment is the radio itself. */}
        <RadioGroup.Root
          value={form.orderType}
          onValueChange={(v) => set('orderType', v as OrderType)}
          aria-label="طريقة الاستلام"
          className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-white/8 p-1 ring-1 ring-gold-hi/35 lg:max-w-[520px]"
        >
          {ORDER_TYPES.map((t) => (
            <RadioGroup.Item
              key={t.value}
              value={t.value}
              className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-band-ink/90 outline-none focus-visible:ring-3 focus-visible:ring-gold-hi/70 data-[state=checked]:bg-linear-to-l data-[state=checked]:from-[#d8b57a] data-[state=checked]:to-gold data-[state=checked]:text-brand"
            >
              <t.icon className="size-[18px]" aria-hidden="true" />
              {t.label}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </BandHeader>
      <BandSheet wide className={cn('lg:pb-12', blocked ? 'pb-56' : 'pb-32')}>
        {/* From 1024px: the form on one side, the summary and the confirm button kept in view on the other. */}
        <form noValidate onSubmit={onSubmit} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
          <div className="grid lg:grid-cols-2 lg:gap-x-4">
            {form.orderType === 'pickup' ? (
              <p className="mt-2 flex items-start gap-2 rounded-2xl bg-gold-soft px-3.5 py-3 text-sm leading-6 ring-1 ring-gold/50 lg:col-span-2">
                <Store className="mt-0.5 size-[18px] shrink-0 text-gold-deep" aria-hidden="true" />
                <span>تستلم طلبك من الفرع: {branch.address}</span>
              </p>
            ) : null}
            <section aria-labelledby="contact-title">
              <h2 id="contact-title" className={groupTitle}>
                بياناتك
              </h2>
              <div className={fieldGroup}>
                <IconField id="name" label="الاسم" icon={User} error={errors.name}>
                  <input {...fieldProps('name', errors.name)} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} className={rowInput} />
                </IconField>
                <IconField id="phone" label="رقم الموبايل" icon={Phone} error={errors.phone}>
                  <input
                    {...fieldProps('phone', errors.phone)}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    placeholder="01XXXXXXXXX"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    className={cn(rowInput, 'text-end tabular-nums')}
                  />
                </IconField>
              </div>
            </section>

            {form.orderType === 'delivery' ? (
              <section aria-labelledby="address-title">
                <h2 id="address-title" className={groupTitle}>
                  عنوان التوصيل
                </h2>
                <div className={fieldGroup}>
                  <IconField id="zoneId" label="المنطقة" icon={MapPin} error={errors.zoneId}>
                    <ZoneCombobox id="zoneId" zones={zones} value={zoneId} onChange={(id) => set('zoneId', id)} onOpenChange={setZoneOpen} error={errors.zoneId} bare />
                  </IconField>
                  <IconField id="street" label="الشارع" icon={Navigation} error={errors.street}>
                    <input {...fieldProps('street', errors.street)} autoComplete="address-line1" value={form.street} onChange={(e) => set('street', e.target.value)} className={rowInput} />
                  </IconField>
                  <IconField id="building" label="رقم العمارة" icon={Building2} error={errors.building}>
                    <input {...fieldProps('building', errors.building)} value={form.building} onChange={(e) => set('building', e.target.value)} className={rowInput} />
                  </IconField>
                  <IconField id="apartment" label="الشقة" icon={DoorOpen} optional>
                    <input {...fieldProps('apartment')} value={form.apartment} onChange={(e) => set('apartment', e.target.value)} className={rowInput} />
                  </IconField>
                  <IconField id="landmark" label="علامة مميزة" icon={Landmark} optional>
                    <input {...fieldProps('landmark')} value={form.landmark} onChange={(e) => set('landmark', e.target.value)} className={rowInput} />
                  </IconField>
                </div>
                <p className="mx-1.5 mt-2 text-xs leading-[18px] text-muted-foreground">
                  منطقتك غير موجودة في القائمة؟ اتصل بالفرع على{' '}
                  <a href={`tel:${branch.phones[0]}`} dir="ltr" className="font-semibold text-foreground underline">
                    {branch.phones[0]}
                  </a>
                  .
                </p>
              </section>
            ) : null}

            <section aria-labelledby="notes-title" className="lg:col-span-2">
              <h2 id="notes-title" className={groupTitle}>
                ملاحظات
              </h2>
              <div className={fieldGroup}>
                <IconField id="notes" label="ملاحظات على الطلب" icon={NotebookPen} optional error={errors.notes}>
                  <textarea {...fieldProps('notes', errors.notes)} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={cn(rowInput, 'h-auto min-h-14 resize-none py-1.5 font-semibold')} />
                </IconField>
              </div>
            </section>
          </div>

          <div className="mt-2 grid gap-4 lg:sticky lg:top-5 lg:mt-0">
            <section aria-labelledby="summary-title" className={cn(card, 'gap-3')}>
              <h2 id="summary-title" className="font-extrabold">
                ملخص الطلب
              </h2>
              <OrderSummary
                lines={lines.map((l) => ({ key: lineKey(l), name: l.name, sizeLabel: l.sizeLabel, qty: l.qty, lineTotal: l.unitPrice * l.qty, note: l.note }))}
                totals={totals}
                orderType={form.orderType}
                taxPercent={branch.charges.tax_percent}
                servicePercent={branch.charges.service_percent}
                zonePending={form.orderType === 'delivery' && !zone}
              />
              <p className="flex items-center gap-2 text-sm font-extrabold text-success-ink">
                <Banknote className="size-5" aria-hidden="true" /> الدفع كاش عند الاستلام
              </p>
            </section>

            {/* Always in reach: the confirm button with anything that stops the order right above it. */}
            {/* On phones the bar is fixed and steps aside while the zone list is open, so it never covers it. */}
            <div
              className={cn(
                'fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/97 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none',
                zoneOpen && 'max-lg:hidden',
              )}
            >
              <div className="mx-auto grid max-w-3xl gap-2">
                {!status.isOpen ? (
                  <p role="alert" className="rounded-2xl bg-gold-soft p-3 text-sm font-semibold text-[#4a3420] ring-1 ring-gold">
                    الفرع مغلق الآن{status.opensAt ? `، ويفتح ${formatTimeAr(status.opensAt)}` : ''}. أكد طلبك في مواعيد العمل.
                  </p>
                ) : null}
                {serverError ? (
                  <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-danger-ink">
                    {serverError}
                  </p>
                ) : null}
                <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={submitting || !status.isOpen}>
                  {submitting ? 'جاري إرسال الطلب…' : (
                    <>
                      تأكيد الطلب · <span className="text-gold-hi tabular-nums">{formatEGP(totals.total)}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </BandSheet>
    </>
  )
}
