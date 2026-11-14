import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fieldProps } from '@/lib/a11y'
import { api, ApiError, errorMessage } from '@/lib/api'
import { branches, getPendingZones, type BranchId, type DeliveryZone, type PendingZone } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { cleanZoneName, DEFAULT_ZONE_TYPE, MAX_ZONE_FEE, MAX_ZONE_NAME, parseZoneFee, zoneKey } from '@/lib/zones'
import { AdminNav } from './AdminNav'

interface ZoneForm {
  type: string
  name: string
  fee: string
}
const emptyForm: ZoneForm = { type: DEFAULT_ZONE_TYPE, name: '', fee: '' }
const FEE_ERROR = `اكتب رسوم التوصيل رقماً صحيحاً من 0 إلى ${MAX_ZONE_FEE} جنيه.`

/** What the branch file says about a zone that has no single fee yet. */
function pendingHint(zone: PendingZone): string {
  const oneFee = zone.feeMin === zone.feeMax
  if (!zone.note) return `في الملف: ${oneFee ? formatEGP(zone.feeMin) : `${zone.feeMin} أو ${formatEGP(zone.feeMax)}`}`
  return oneFee ? `${formatEGP(zone.feeMin)} · ${zone.note}` : zone.note
}

export function ZonesPage() {
  const [branchId, setBranchId] = useState<BranchId>(branches[0].id)
  const [zones, setZones] = useState<DeliveryZone[] | null>(null)
  const [form, setForm] = useState<ZoneForm>(emptyForm)
  const [errors, setErrors] = useState<{ name?: string; fee?: string }>({})
  const [saving, setSaving] = useState(false)
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const branch = branches.find((b) => b.id === branchId) ?? branches[0]

  useEffect(() => {
    let alive = true
    const load = async () => {
      const list = await api.listZones(branchId)
      if (alive) setZones(list)
    }
    void load()
    const stop = api.subscribe(() => void load())
    return () => {
      alive = false
      stop()
    }
  }, [branchId])

  const list = useMemo(() => zones ?? [], [zones])
  // Ashry groups its zones (مجاورة، حي، كود); the other branches have plain areas only.
  const types = useMemo(() => [...new Set([...list.map((z) => z.type), DEFAULT_ZONE_TYPE])], [list])
  const pending = useMemo(() => {
    const taken = new Set(list.map((z) => zoneKey(z.label)))
    return getPendingZones(branchId).filter((p) => !taken.has(zoneKey(p.label)))
  }, [branchId, list])
  const added = list.filter((z) => z.custom)
  const wanted = zoneKey(query)
  const visible = [...added].reverse().concat(list.filter((z) => !z.custom)).filter((z) => !wanted || zoneKey(z.label).includes(wanted))
  const nameLabel = form.type === DEFAULT_ZONE_TYPE ? 'اسم المنطقة' : `رقم أو اسم ال${form.type}`

  function chooseBranch(id: BranchId) {
    setBranchId(id)
    setZones(null)
    setForm(emptyForm)
    setErrors({})
    setLastAdded(null)
    setQuery('')
    setConfirmId(null)
  }

  function priceLater(zone: PendingZone) {
    setForm({ type: zone.type, name: zone.name, fee: '' })
    setErrors({})
    document.getElementById('zone-fee')?.focus()
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = cleanZoneName(form.name)
    const fee = parseZoneFee(form.fee)
    const found = {
      name: name === '' ? 'اكتب اسم المنطقة.' : name.length > MAX_ZONE_NAME ? `الاسم طويل، الحد ${MAX_ZONE_NAME} حرفاً.` : undefined,
      fee: fee === null ? FEE_ERROR : undefined,
    }
    setErrors(found)
    if (found.name) return document.getElementById('zone-name')?.focus()
    if (fee === null) return document.getElementById('zone-fee')?.focus()

    setSaving(true)
    try {
      const zone = await api.addZone(branch.id, { type: form.type, name, fee })
      const message = `أُضيفت «${zone.label}» إلى فرع ${branch.name} برسوم ${formatEGP(zone.fee)}.`
      setLastAdded(message)
      toast.success(message)
      setForm((f) => ({ ...f, name: '', fee: '' }))
      document.getElementById('zone-name')?.focus()
    } catch (err) {
      const onFee = err instanceof ApiError && err.code === 'INVALID_ZONE_FEE'
      setErrors(onFee ? { fee: errorMessage(err) } : { name: errorMessage(err) })
      document.getElementById(onFee ? 'zone-fee' : 'zone-name')?.focus()
    } finally {
      setSaving(false)
    }
  }

  async function remove(zone: DeliveryZone) {
    try {
      await api.removeZone(zone.id)
      setConfirmId(null)
      setLastAdded(null)
      toast.success(`حُذفت «${zone.label}» من فرع ${branch.name}.`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <title>مناطق التوصيل | خليها مشاوي</title>
      <SiteHeader wide title="لوحة الكول سنتر" />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6">
        <AdminNav />
        <h1 className="text-2xl font-extrabold">مناطق التوصيل</h1>
        {api.mode === 'local' ? (
          <p role="note" className="rounded-lg bg-amber-100 p-3 text-sm font-semibold text-amber-950">
            وضع تجريبي: المناطق التي تضيفها تُحفظ في هذا المتصفح فقط. بعد ربط قاعدة البيانات تظهر لكل الأجهزة، ويضيفها المدير فقط.
          </p>
        ) : null}

        <div role="group" aria-label="الفرع" className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <Button key={b.id} size="lg" className="h-11" variant={b.id === branchId ? 'default' : 'outline'} aria-pressed={b.id === branchId} onClick={() => chooseBranch(b.id)}>
              فرع {b.name}
            </Button>
          ))}
        </div>

        <section aria-labelledby="add-title" className="grid gap-4 rounded-xl border bg-card p-4">
          <h2 id="add-title" className="text-lg font-bold">
            إضافة منطقة إلى فرع {branch.name}
          </h2>
          <form noValidate onSubmit={onSubmit} className="grid items-start gap-4 sm:grid-cols-[auto_1fr_10rem_auto]">
            {types.length > 1 ? (
              <Field id="zone-type" label="النوع">
                <select
                  id="zone-type"
                  name="zone-type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Field id="zone-name" label={nameLabel} error={errors.name}>
              <Input {...fieldProps('zone-name', errors.name)} className="h-11" maxLength={MAX_ZONE_NAME + 20} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field id="zone-fee" label="رسوم التوصيل (ج.م)" error={errors.fee}>
              <Input
                {...fieldProps('zone-fee', errors.fee)}
                inputMode="numeric"
                dir="ltr"
                className="h-11 text-start"
                value={form.fee}
                onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
              />
            </Field>
            <Button type="submit" size="lg" className="h-11 sm:mt-[1.625rem]" disabled={saving}>
              <Plus aria-hidden="true" /> إضافة المنطقة
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">تظهر المنطقة للعميل فور إضافتها، وتُحسب رسومها في إجمالي الطلب.</p>
          <p role="status" className="text-sm font-semibold text-emerald-800 empty:hidden">
            {lastAdded}
          </p>
        </section>

        {pending.length > 0 ? (
          <section aria-labelledby="pending-title" className="grid gap-3 rounded-xl border bg-card p-4">
            <h2 id="pending-title" className="text-lg font-bold">
              مناطق تحتاج سعراً ({pending.length})
            </h2>
            <p className="text-sm text-muted-foreground">هذه المناطق في ملف الفرع بأكثر من سعر أو بملاحظة، فلا تظهر للعميل. حدد لكل منطقة سعراً واحداً لتظهر.</p>
            <ul className="divide-y">
              {pending.map((p) => (
                <li key={p.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-sm text-muted-foreground">{pendingHint(p)}</span>
                  <Button variant="outline" className="ms-auto h-9" onClick={() => priceLater(p)} aria-label={`حدد السعر: ${p.label}`}>
                    حدد السعر
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="list-title" className="grid gap-3 rounded-xl border bg-card p-4">
          <h2 id="list-title" className="text-lg font-bold">
            مناطق فرع {branch.name} ({list.length})
          </h2>
          {zones === null ? (
            <p aria-busy="true">جاري تحميل المناطق…</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {added.length > 0 ? `منها ${added.length} مضافة من هذه الشاشة، وتظهر أول القائمة.` : 'كلها من ملف الفرع الأصلي. لم تُضف مناطق من هذه الشاشة بعد.'}
              </p>
              <div className="max-w-sm">
                <Field id="zone-search" label="بحث باسم المنطقة">
                  <Input id="zone-search" type="search" className="h-10" value={query} onChange={(e) => setQuery(e.target.value)} />
                </Field>
              </div>
              {visible.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">لا توجد منطقة بهذا الاسم.</p>
              ) : (
                <ul className="divide-y" aria-label="قائمة المناطق">
                  {visible.map((z) => (
                    <li key={z.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                      <span className="font-semibold">{z.label}</span>
                      {z.custom ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">مضافة</span> : null}
                      <span className="ms-auto font-bold tabular-nums">{formatEGP(z.fee)}</span>
                      {z.custom ? (
                        confirmId === z.id ? (
                          <span className="flex gap-2">
                            <Button className="h-9 bg-red-700 text-white hover:bg-red-800" onClick={() => void remove(z)}>
                              تأكيد الحذف
                            </Button>
                            <Button variant="outline" className="h-9" onClick={() => setConfirmId(null)}>
                              تراجع
                            </Button>
                          </span>
                        ) : (
                          <Button variant="ghost" className="h-9 text-red-700" onClick={() => setConfirmId(z.id)} aria-label={`حذف ${z.label}`}>
                            <Trash2 aria-hidden="true" /> حذف
                          </Button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </main>
    </>
  )
}
