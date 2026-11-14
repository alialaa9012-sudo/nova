import { Banknote, Bike, Store } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Field } from '@/components/Field'
import { OrderSummary } from '@/components/OrderSummary'
import { SiteHeader } from '@/components/SiteHeader'
import { ZoneCombobox } from '@/components/ZoneCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useNow } from '@/hooks/useNow'
import { fieldProps } from '@/lib/a11y'
import { api, errorMessage } from '@/lib/api'
import type { DeliveryZone } from '@/lib/catalog'
import { emptyCheckoutForm, validateCheckout, type CheckoutErrors, type CheckoutForm } from '@/lib/checkout'
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
const card = 'grid rounded-[20px] bg-card p-4 shadow-card'

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
  const [form, setForm] = useState<CheckoutForm>(emptyCheckoutForm)
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const zone = zones.find((z) => z.id === form.zoneId)
  const totals = computeTotals(lines, form.orderType, zone?.fee ?? 0, branch.charges)
  const status = getOpenStatus(branch.hours, now, branch.timezone)
  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const menuPath = `/branch/${branch.id}`

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const found = validateCheckout(form)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      document.getElementById(first)?.focus()
      return
    }
    setSubmitting(true)
    setServerError(null)
    try {
      const order = await api.placeOrder({
        branchId: branch.id,
        orderType: form.orderType,
        customerName: form.name,
        phone: form.phone,
        zoneId: form.orderType === 'delivery' ? form.zoneId : undefined,
        street: form.street,
        building: form.building,
        apartment: form.apartment,
        landmark: form.landmark,
        notes: form.notes,
        lines: lines.map((l) => ({ sizeId: l.sizeId, qty: l.qty })),
      })
      dispatch({ type: 'clear' })
      rememberOrder(order.number, order.phone)
      navigate(`/order/${order.number}`, { state: { phone: order.phone, justPlaced: true } })
    } catch (err) {
      setServerError(errorMessage(err))
      setSubmitting(false)
    }
  }

  if (lines.length === 0) {
    return (
      <>
        <title>إتمام الطلب | خليها مشاوي</title>
        <SiteHeader narrow backTo={menuPath} backLabel="رجوع للمنيو" title="إتمام الطلب" />
        <main className="mx-auto grid max-w-3xl gap-4 px-5 py-12 text-center">
          <h1 className="text-2xl font-bold">السلة فارغة</h1>
          <p className="text-muted-foreground">أضف أصنافاً من المنيو أولاً.</p>
          <Button asChild size="lg" className="mx-auto">
            <Link to={menuPath}>العودة للمنيو</Link>
          </Button>
        </main>
      </>
    )
  }

  const blocked = !status.isOpen || Boolean(serverError)
  return (
    <>
      <title>{`إتمام الطلب · فرع ${branch.name} | خليها مشاوي`}</title>
      <SiteHeader narrow backTo={menuPath} backLabel="رجوع للمنيو" title={`فرع ${branch.name}`} />
      {/* The bottom padding keeps the last card clear of the fixed confirm bar. */}
      <main className={cn('mx-auto max-w-3xl px-5 pt-2', blocked ? 'pb-56' : 'pb-32')}>
        <h1 className="text-[26px] leading-9 font-extrabold">إتمام الطلب</h1>
        <form noValidate onSubmit={onSubmit} className="mt-4 grid gap-4">
          <section aria-labelledby="type-title" className={cn(card, 'gap-3')}>
            <h2 id="type-title" className="font-bold">
              طريقة الاستلام
            </h2>
            <RadioGroup
              value={form.orderType}
              onValueChange={(v) => set('orderType', v as OrderType)}
              className="grid grid-cols-2 gap-3"
              aria-labelledby="type-title"
            >
              {ORDER_TYPES.map((t) => (
                <Label
                  key={t.value}
                  htmlFor={`type-${t.value}`}
                  className="flex min-h-16 cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-transparent bg-surface p-3 text-[15px] leading-5 font-semibold has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand-tint"
                >
                  <RadioGroupItem id={`type-${t.value}`} value={t.value} />
                  <t.icon className="size-5 shrink-0" aria-hidden="true" />
                  {t.label}
                </Label>
              ))}
            </RadioGroup>
            {form.orderType === 'pickup' ? <p className="text-sm">تستلم طلبك من الفرع: {branch.address}</p> : null}
          </section>

          <section aria-labelledby="contact-title" className={cn(card, 'gap-4')}>
            <h2 id="contact-title" className="font-bold">
              بياناتك
            </h2>
            <Field id="name" label="الاسم" error={errors.name}>
              <Input {...fieldProps('name', errors.name)} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field id="phone" label="رقم الموبايل" error={errors.phone}>
              <Input
                {...fieldProps('phone', errors.phone)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className="text-end"
                placeholder="01XXXXXXXXX"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
          </section>

          {form.orderType === 'delivery' ? (
            <section aria-labelledby="address-title" className={cn(card, 'gap-4')}>
              <h2 id="address-title" className="font-bold">
                عنوان التوصيل
              </h2>
              <Field id="zoneId" label="المنطقة" error={errors.zoneId}>
                <ZoneCombobox id="zoneId" zones={zones} value={form.zoneId} onChange={(zoneId) => set('zoneId', zoneId)} error={errors.zoneId} />
              </Field>
              <p className="text-xs leading-[18px] text-muted-foreground">
                منطقتك غير موجودة في القائمة؟ اتصل بالفرع على{' '}
                <a href={`tel:${branch.phones[0]}`} dir="ltr" className="font-semibold text-foreground underline">
                  {branch.phones[0]}
                </a>
                .
              </p>
              <Field id="street" label="الشارع" error={errors.street}>
                <Input {...fieldProps('street', errors.street)} autoComplete="address-line1" value={form.street} onChange={(e) => set('street', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="building" label="رقم العمارة" error={errors.building}>
                  <Input {...fieldProps('building', errors.building)} value={form.building} onChange={(e) => set('building', e.target.value)} />
                </Field>
                <Field id="apartment" label="الشقة" optional>
                  <Input {...fieldProps('apartment')} value={form.apartment} onChange={(e) => set('apartment', e.target.value)} />
                </Field>
              </div>
              <Field id="landmark" label="علامة مميزة" optional>
                <Input {...fieldProps('landmark')} value={form.landmark} onChange={(e) => set('landmark', e.target.value)} />
              </Field>
            </section>
          ) : null}

          <section aria-labelledby="notes-title" className={cn(card, 'gap-3')}>
            <h2 id="notes-title" className="font-bold">
              ملاحظات
            </h2>
            <Field id="notes" label="ملاحظات على الطلب" optional error={errors.notes}>
              <Textarea {...fieldProps('notes', errors.notes)} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </section>

          <section aria-labelledby="summary-title" className={cn(card, 'gap-3')}>
            <h2 id="summary-title" className="font-bold">
              ملخص الطلب
            </h2>
            <OrderSummary
              lines={lines.map((l) => ({ key: l.sizeId, name: l.name, sizeLabel: l.sizeLabel, qty: l.qty, lineTotal: l.unitPrice * l.qty }))}
              totals={totals}
              orderType={form.orderType}
              taxPercent={branch.charges.tax_percent}
              servicePercent={branch.charges.service_percent}
              zonePending={form.orderType === 'delivery' && !zone}
            />
            <p className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-tint px-3 text-sm font-semibold">
              <Banknote className="size-5" aria-hidden="true" /> الدفع كاش عند الاستلام
            </p>
          </section>

          {/* Always in reach: the confirm button with anything that stops the order right above it. */}
          <div className="fixed inset-x-0 bottom-0 z-20 bg-linear-to-t from-background from-75% to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto grid max-w-3xl gap-2">
              {!status.isOpen ? (
                <p role="alert" className="rounded-2xl bg-stone-200 p-3 text-sm font-semibold text-stone-900">
                  الفرع مغلق الآن{status.opensAt ? `، ويفتح ${formatTimeAr(status.opensAt)}` : ''}. أكد طلبك في مواعيد العمل.
                </p>
              ) : null}
              {serverError ? (
                <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                  {serverError}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="w-full shadow-cta" disabled={submitting || !status.isOpen}>
                {submitting ? 'جاري إرسال الطلب…' : `تأكيد الطلب · ${formatEGP(totals.total)}`}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </>
  )
}
