import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNow } from '@/hooks/useNow'
import { api, errorMessage, type Order } from '@/lib/api'
import { playBeep } from '@/lib/beep'
import { branches } from '@/lib/catalog'
import { cairoDate } from '@/lib/format'
import { nextStatus, statusLabel, type OrderStatus } from '@/lib/orderStatus'
import { toAsciiDigits } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { AdminNav } from './AdminNav'
import { CancelDialog } from './CancelDialog'
import { OrderCard } from './OrderCard'
import { OrderDetailsSheet } from './OrderDetailsSheet'

type Filter = OrderStatus | 'all'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'new', label: 'جديد' },
  { value: 'preparing', label: 'جاري التجهيز' },
  { value: 'out_for_delivery', label: 'خرج / جاهز للاستلام' },
  { value: 'cancelled', label: 'ملغي' },
  { value: 'all', label: 'الكل' },
]

export function AdminPage() {
  const now = useNow(15_000)
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [branchFilter, setBranchFilter] = useState('all')
  const [date, setDate] = useState(() => cairoDate(new Date()))
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('new')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const known = useRef<Set<string> | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const list = await api.listOrders()
      if (!alive) return
      const seen = known.current
      const fresh = seen ? list.filter((o) => !seen.has(o.id)) : []
      if (fresh.length > 0) {
        playBeep()
        toast.success(`طلب جديد: ${fresh.map((o) => o.number).join('، ')}`)
      }
      known.current = new Set(list.map((o) => o.id))
      setOrders(list)
      setLoaded(true)
    }
    void load()
    const stop = api.subscribe(() => void load())
    const timer = setInterval(() => void load(), 20_000)
    return () => {
      alive = false
      stop()
      clearInterval(timer)
    }
  }, [])

  const q = toAsciiDigits(query).trim().toUpperCase()
  const inScope = orders.filter(
    (o) =>
      (branchFilter === 'all' || o.branchId === branchFilter) &&
      (!date || o.date === date) &&
      (!q || o.number.includes(q) || o.phone.includes(q)),
  )
  const countOf = (f: Filter) => (f === 'all' ? inScope.length : inScope.filter((o) => o.status === f).length)
  const visible = filter === 'all' ? inScope : inScope.filter((o) => o.status === filter)
  const detail = orders.find((o) => o.id === detailId) ?? null
  const cancelling = orders.find((o) => o.id === cancelId) ?? null

  async function advance(order: Order) {
    const next = nextStatus(order.status)
    if (!next) return
    try {
      await api.setStatus(order.id, next)
      toast.success(`طلب ${order.number}: ${statusLabel(next, order.orderType)}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function cancel(order: Order, reason: string) {
    try {
      await api.setStatus(order.id, 'cancelled', reason)
      setCancelId(null)
      toast.success(`أُلغي الطلب ${order.number}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <title>لوحة الكول سنتر | خليها مشاوي</title>
      <SiteHeader wide logo title="لوحة الكول سنتر" />
      <main className="mx-auto grid max-w-[1280px] gap-4 px-5 pt-2 pb-8 md:px-6">
        <AdminNav />
        <h1 className="text-[26px] leading-9 font-extrabold">الطلبات</h1>
        {api.mode === 'local' ? (
          <p role="note" className="rounded-2xl bg-amber-100 p-3 text-sm font-semibold text-amber-950">
            وضع تجريبي: تظهر هنا طلبات هذا المتصفح فقط. بعد ربط قاعدة البيانات تصل الطلبات من كل الأجهزة، ويدخل الموظفون بحساباتهم.
          </p>
        ) : null}
        <div className="grid gap-3 rounded-[20px] bg-card p-4 shadow-card sm:grid-cols-3">
          <Field id="f-branch" label="الفرع">
            <select
              id="f-branch"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-[52px] w-full rounded-2xl border border-input bg-surface px-4 text-base outline-none focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand"
            >
              <option value="all">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-date" label="التاريخ">
            <Input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="f-search" label="بحث برقم الطلب أو الموبايل">
            <Input id="f-search" type="search" dir="ltr" className="text-end" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
        </div>
        <div role="group" aria-label="تصفية حسب الحالة" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant="outline"
              // Dark when active, so staff filters never look like the orange customer actions.
              className={cn('h-10 px-4 text-[13px] font-semibold', filter === f.value && 'bg-foreground text-white shadow-none hover:bg-foreground active:bg-foreground')}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label} ({countOf(f.value)})
            </Button>
          ))}
        </div>
        {!loaded ? (
          <p aria-busy="true">جاري تحميل الطلبات…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-[20px] bg-card p-8 text-center text-muted-foreground shadow-card">لا توجد طلبات بهذه التصفية.</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 min-[1440px]:grid-cols-3" aria-label="قائمة الطلبات">
            {visible.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} now={now} onAdvance={() => void advance(o)} onCancel={() => setCancelId(o.id)} onOpen={() => setDetailId(o.id)} />
              </li>
            ))}
          </ul>
        )}
      </main>
      {detail ? (
        <OrderDetailsSheet order={detail} onClose={() => setDetailId(null)} onAdvance={() => void advance(detail)} onCancel={() => setCancelId(detail.id)} />
      ) : null}
      {cancelling ? (
        <CancelDialog key={cancelling.id} order={cancelling} onClose={() => setCancelId(null)} onConfirm={(reason) => void cancel(cancelling, reason)} />
      ) : null}
    </>
  )
}
