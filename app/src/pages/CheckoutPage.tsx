import { Banknote } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Field } from '@/components/Field'
import { OrderSummary } from '@/components/OrderSummary'
import { SiteHeader } from '@/components/SiteHeader'
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

const GROUP_TITLES: Record<string, string> = { مجاورة: 'المجاورات', حي: 'الأحياء', كود: 'الأكواد', منطقة: 'المناطق' }
const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'delivery', label: 'توصيل للعنوان' },
  { value: 'pickup', label: 'استلام من الفرع' },
]

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
  const zoneGroups = useMemo(() => {
    const groups = new Map<string, DeliveryZone[]>()
    for (const z of zones) groups.set(z.type, [...(groups.get(z.type) ?? []), z])
    return [...groups.entries()]
  }, [zones])
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
        <SiteHeader backTo={menuPath} backLabel="رجوع للمنيو" title="إتمام الطلب" />
        <main className="mx-auto grid max-w-3xl gap-4 px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">السلة فارغة</h1>
          <p className="text-muted-foreground">أضف أصنافاً من المنيو أولاً.</p>
          <Button asChild size="lg" className="mx-auto h-12">
            <Link to={menuPath}>العودة للمنيو</Link>
          </Button>
        </main>
      </>
    )
  }

  return (
    <>
      <title>{`إتمام الطلب · فرع ${branch.name} | خليها مشاوي`}</title>
      <SiteHeader backTo={menuPath} backLabel="رجوع للمنيو" title={`فرع ${branch.name}`} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-extrabold">إتمام الطلب</h1>
        <form noValidate onSubmit={onSubmit} className="mt-4 grid gap-5">
          <section aria-labelledby="type-title" className="grid gap-3 rounded-xl border bg-card p-4">
            <h2 id="type-title" className="font-bold">
              طريقة الاستلام
            </h2>
            <RadioGroup
              value={form.orderType}
              onValueChange={(v) => set('orderType', v as OrderType)}
              className="grid grid-cols-2 gap-2"
              aria-labelledby="type-title"
            >
              {ORDER_TYPES.map((t) => (
                <Label
                  key={t.value}
                  htmlFor={`type-${t.value}`}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-base has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary"
                >
                  <RadioGroupItem id={`type-${t.value}`} value={t.value} />
                  {t.label}
                </Label>
              ))}
            </RadioGroup>
            {form.orderType === 'pickup' ? <p className="text-sm">تستلم طلبك من الفرع: {branch.address}</p> : null}
          </section>

          <section aria-labelledby="contact-title" className="grid gap-4 rounded-xl border bg-card p-4">
            <h2 id="contact-title" className="font-bold">
              بياناتك
            </h2>
            <Field id="name" label="الاسم" error={errors.name}>
              <Input {...fieldProps('name', errors.name)} className="h-11" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field id="phone" label="رقم الموبايل" error={errors.phone}>
              <Input
                {...fieldProps('phone', errors.phone)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className="h-11 text-start"
                placeholder="01XXXXXXXXX"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
          </section>

          {form.orderType === 'delivery' ? (
            <section aria-labelledby="address-title" className="grid gap-4 rounded-xl border bg-card p-4">
              <h2 id="address-title" className="font-bold">
                عنوان التوصيل
              </h2>
              <Field id="zoneId" label="المنطقة" error={errors.zoneId}>
                <select
                  {...fieldProps('zoneId', errors.zoneId)}
                  value={form.zoneId}
                  onChange={(e) => set('zoneId', e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <option value="">اختر المنطقة</option>
                  {zoneGroups.length === 1
                    ? zoneGroups[0][1].map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.label} · {formatEGP(z.fee)}
                        </option>
                      ))
                    : zoneGroups.map(([type, list]) => (
                        <optgroup key={type} label={GROUP_TITLES[type] ?? type}>
                          {list.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.label} · {formatEGP(z.fee)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                </select>
              </Field>
              <p className="text-sm text-muted-foreground">
                منطقتك غير موجودة في القائمة؟ اتصل بالفرع على{' '}
                <a href={`tel:${branch.phones[0]}`} dir="ltr" className="font-semibold text-foreground underline">
                  {branch.phones[0]}
                </a>
                .
              </p>
              <Field id="street" label="الشارع" error={errors.street}>
                <Input {...fieldProps('street', errors.street)} className="h-11" autoComplete="address-line1" value={form.street} onChange={(e) => set('street', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="building" label="رقم العمارة" error={errors.building}>
                  <Input {...fieldProps('building', errors.building)} className="h-11" value={form.building} onChange={(e) => set('building', e.target.value)} />
                </Field>
                <Field id="apartment" label="الشقة" optional>
                  <Input {...fieldProps('apartment')} className="h-11" value={form.apartment} onChange={(e) => set('apartment', e.target.value)} />
                </Field>
              </div>
              <Field id="landmark" label="علامة مميزة" optional>
                <Input {...fieldProps('landmark')} className="h-11" value={form.landmark} onChange={(e) => set('landmark', e.target.value)} />
              </Field>
            </section>
          ) : null}

          <section aria-labelledby="notes-title" className="grid gap-3 rounded-xl border bg-card p-4">
            <h2 id="notes-title" className="font-bold">
              ملاحظات
            </h2>
            <Field id="notes" label="ملاحظات على الطلب" optional error={errors.notes}>
              <Textarea {...fieldProps('notes', errors.notes)} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </section>

          <section aria-labelledby="summary-title" className="grid gap-3 rounded-xl border bg-card p-4">
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
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Banknote className="size-5" aria-hidden="true" /> الدفع كاش عند الاستلام
            </p>
          </section>

          {!status.isOpen ? (
            <p role="alert" className="rounded-lg bg-stone-200 p-3 font-semibold text-stone-900">
              الفرع مغلق الآن{status.opensAt ? `، ويفتح ${formatTimeAr(status.opensAt)}` : ''}. أكد طلبك في مواعيد العمل.
            </p>
          ) : null}
          {serverError ? (
            <p role="alert" className="rounded-lg bg-red-50 p-3 font-semibold text-red-800">
              {serverError}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="h-12 text-base" disabled={submitting || !status.isOpen}>
            {submitting ? 'جاري إرسال الطلب…' : `تأكيد الطلب · ${formatEGP(totals.total)}`}
          </Button>
        </form>
      </main>
    </>
  )
}
