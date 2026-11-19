import { useEffect, useState, type ReactNode } from 'react'
import { Field } from '@/components/Field'
import { SelectInput } from '@/components/SelectInput'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import type { VisitFunnel, VisitStep } from '@/lib/api/types'
import { branches, type BranchId } from '@/lib/catalog'
import { cairoDate, formatDateAr } from '@/lib/format'
import { AdminNav } from './AdminNav'

/** Where a visitor who did not order stopped, in the order a visit goes. */
const STOPS: { step: Exclude<VisitStep, 'ordered'>; label: string; hint: string }[] = [
  { step: 'home', label: 'الصفحة الرئيسية', hint: 'دخل الموقع ولم يفتح منيو أي فرع' },
  { step: 'menu', label: 'المنيو', hint: 'فتح المنيو ولم يضف شيئاً للسلة' },
  { step: 'cart', label: 'السلة', hint: 'أضاف أصنافاً للسلة ولم يفتح إتمام الطلب' },
  { step: 'checkout', label: 'إتمام الطلب', hint: 'فتح صفحة إتمام الطلب ولم يؤكد الطلب' },
]

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
/** «28%» kept left-to-right, so the sign never jumps to the wrong side of the number. */
const Pct = ({ value }: { value: number }) => <bdi dir="ltr">{value}%</bdi>
/** As on the orders board: label, box and caption rows shared, so the boxes stay level. */
const FIELD_CELL = 'row-span-3 grid-rows-subgrid [&>label]:self-end'

/** Staff: how many people visited on a day, how many ordered, and where the others stopped. */
export function VisitsPage() {
  const [date, setDate] = useState(() => cairoDate(new Date()))
  const [branchFilter, setBranchFilter] = useState<'all' | BranchId>('all')
  const [funnel, setFunnel] = useState<VisitFunnel | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const f = await api.visitFunnel({ date, branchId: branchFilter === 'all' ? undefined : branchFilter })
        if (alive) setFunnel(f)
      } catch {
        /* offline: the next tick tries again */
      }
    }
    void load()
    const timer = setInterval(() => void load(), 60_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [date, branchFilter])

  const didNotOrder = funnel ? funnel.visitors - funnel.ordered : 0
  const stops = branchFilter === 'all' ? STOPS : STOPS.slice(1) // a branch's visitors all opened its menu
  return (
    <>
      <title>الزوار | لوحة الكول سنتر</title>
      <AdminNav />
      <main id="content" tabIndex={-1} className="mx-auto grid max-w-[1320px] gap-4 px-5 pt-4 pb-8 outline-none md:px-6 lg:px-8">
        <h1 className="sr-only">الزوار</h1>
        <div className="grid grid-cols-2 gap-x-3 rounded-[20px] bg-card p-4 shadow-card sm:max-w-xl">
          <Field id="v-branch" label="الفرع" className={FIELD_CELL}>
            <SelectInput id="v-branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as 'all' | BranchId)}>
              <option value="all">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="v-date" label="التاريخ" className={FIELD_CELL}>
            <Input id="v-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby="v-date-ar" />
            <p id="v-date-ar" className="text-xs font-semibold text-muted-foreground">
              {formatDateAr(date)}
            </p>
          </Field>
        </div>

        {!funnel ? (
          <p aria-busy="true">جاري التحميل…</p>
        ) : (
          <>
            <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="ملخص الزوار">
              <Stat label="زوار" value={funnel.visitors} />
              <Stat label="طلبوا" value={funnel.ordered} note={<><Pct value={pct(funnel.ordered, funnel.visitors)} /> من الزوار</>} />
              <Stat label="لم يطلبوا" value={didNotOrder} note={<><Pct value={pct(didNotOrder, funnel.visitors)} /> من الزوار</>} />
            </ul>
            <section aria-labelledby="stops-title" className="grid gap-3 rounded-[20px] bg-card p-4 shadow-card lg:p-5">
              <h2 id="stops-title" className="text-lg font-extrabold">
                أين توقف من لم يطلب؟
              </h2>
              {didNotOrder === 0 ? (
                <p className="text-muted-foreground">لا يوجد زوار بدون طلب في هذا اليوم.</p>
              ) : (
                <ol className="grid gap-3">
                  {stops.map((s) => (
                    <li key={s.step} className="grid gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p>
                          <span className="font-extrabold">{s.label}</span>
                          <span className="text-sm text-muted-foreground"> · {s.hint}</span>
                        </p>
                        <p className="shrink-0 font-extrabold tabular-nums">
                          {funnel[s.step]}{' '}
                          <span className="text-sm font-semibold text-muted-foreground">
                            (<Pct value={pct(funnel[s.step], didNotOrder)} />)
                          </span>
                        </p>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-control" aria-hidden="true">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${pct(funnel[s.step], didNotOrder)}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-xs text-muted-foreground">
                يُحسب كل جهاز زائراً واحداً في اليوم، بلا اسم أو رقم موبايل. يتحدّث كل دقيقة.
              </p>
            </section>
          </>
        )}
      </main>
    </>
  )
}

function Stat({ label, value, note }: { label: string; value: number; note?: ReactNode }) {
  return (
    <li className="grid content-start gap-0.5 rounded-[20px] bg-card p-3 shadow-card sm:p-4">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</p>
      {note ? <p className="text-xs font-semibold text-muted-foreground">{note}</p> : null}
    </li>
  )
}
