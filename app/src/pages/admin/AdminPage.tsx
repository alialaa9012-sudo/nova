import { BellRing } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { SelectInput } from '@/components/SelectInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNow } from '@/hooks/useNow'
import { api, errorMessage, type Order } from '@/lib/api'
import { askNotify, notify, notifyPermission, playBeep, soundReady, startRinging, stopRinging, unlockSound, unlockSoundOnGesture } from '@/lib/alerts'
import { branches, getBranch } from '@/lib/catalog'
import { cairoDate, formatDateAr, formatEGP } from '@/lib/format'
import { nextStatus, statusLabel, type OrderStatus } from '@/lib/orderStatus'
import { toAsciiDigits } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { AdminNav } from './AdminNav'
import { CancelDialog } from './CancelDialog'
import { OrderCard } from './OrderCard'
import { OrderDetailsSheet } from './OrderDetailsSheet'
import { cleanOrderNumber, orderLabel } from '@/lib/orderNumber'

type Filter = OrderStatus | 'all'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'new', label: 'جديد' },
  { value: 'preparing', label: 'جاري التجهيز' },
  { value: 'out_for_delivery', label: 'خرج / جاهز للاستلام' },
  { value: 'delivered', label: 'تم التسليم' },
  { value: 'cancelled', label: 'ملغي' },
  { value: 'all', label: 'الكل' },
]

/** A filter field as three rows of the filter grid: label (pushed down to its box), box, caption. */
const FIELD_CELL = 'row-span-3 grid-rows-subgrid [&>label]:self-end'

/** How often the board asks for orders created or changed since its last look. */
const POLL_MS = 15_000
/** How often it re-reads the whole day, in case something was missed or removed. */
const FULL_RELOAD_MS = 5 * 60_000

const stamp = (o: Order) => Date.parse(o.updatedAt ?? o.createdAt) || 0

/** Puts fresh copies of orders into the list, never replacing a copy with an older one. */
function mergeOrders(list: Order[], incoming: Order[]): Order[] {
  const next = list.slice()
  for (const order of incoming) {
    const i = next.findIndex((o) => o.id === order.id)
    if (i < 0) next.unshift(order)
    else if (stamp(order) >= stamp(next[i])) next[i] = order
  }
  return next
}

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
  const [sound, setSound] = useState(soundReady)
  const [permission, setPermission] = useState(notifyPermission)
  const known = useRef<Set<string> | null>(null)

  // The board holds one day's orders. A push from the database fetches only the order that changed.
  // Pushes can be lost (a dropped connection, a sleeping screen), so every 15 seconds it also asks for
  // whatever changed since its last look, and re-reads the whole day every 5 minutes.
  useEffect(() => {
    let alive = true
    let cursor = 0 // the newest change seen, in ms
    known.current = null // a new day is not a burst of new orders
    const day = date || undefined

    const announce = (fresh: Order[]) => {
      const waiting = fresh.filter((o) => o.status === 'new')
      if (waiting.length === 0) return
      toast.success(`طلب جديد: ${waiting.map((o) => orderLabel(o.number)).join('، ')}`)
      if (document.hidden || !document.hasFocus()) {
        for (const o of waiting) {
          const where = `${getBranch(o.branchId)?.name ?? ''} · ${o.orderType === 'delivery' ? 'توصيل' : 'استلام'}`
          notify(`طلب جديد ${orderLabel(o.number)}`, `${where} · ${formatEGP(o.totals.total)}`, o.id)
        }
      }
    }
    const take = (incoming: Order[], replace: boolean) => {
      for (const o of incoming) cursor = Math.max(cursor, stamp(o))
      const seen = known.current
      if (seen) announce(incoming.filter((o) => !seen.has(o.id)))
      known.current = new Set([...(replace ? [] : (seen ?? [])), ...incoming.map((o) => o.id)])
      setOrders((list) => (replace ? incoming : mergeOrders(list, incoming)))
      setLoaded(true)
    }
    const load = async () => {
      try {
        const list = await api.listOrders({ date: day })
        if (alive) take(list, true)
      } catch {
        /* offline: the next tick tries again */
      }
    }
    const poll = async () => {
      if (!cursor) return load()
      try {
        // A little overlap: a change saved during the last look can carry a slightly older time.
        const list = await api.listOrders({ date: day, since: new Date(cursor - 15_000).toISOString() })
        if (alive && list.length) take(list, false)
      } catch {
        /* offline: the next tick tries again */
      }
    }
    const refreshOne = async (orderId: string) => {
      try {
        const order = await api.getOrder(orderId)
        if (!alive) return
        if (!order || (date && order.date !== date)) setOrders((list) => list.filter((o) => o.id !== orderId))
        else take([order], false)
      } catch {
        void poll()
      }
    }
    const onVisible = () => {
      if (!document.hidden) void poll()
    }

    void load()
    const stop = api.subscribe((change) => void (change?.orderId ? refreshOne(change.orderId) : load()), { pollMs: FULL_RELOAD_MS })
    const timer = setInterval(() => void poll(), POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      alive = false
      stop()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [date])

  // A click or key press anywhere unlocks sound. The reminder bar stays until its own button is used:
  // removing it mid-click would move the page under the pointer and the click would land elsewhere.
  useEffect(() => unlockSoundOnGesture(), [])

  // The board rings for as long as any order is still waiting to be accepted, on every screen that
  // shows it, and stops once each one is accepted or cancelled (here or on another screen).
  const waitingCount = orders.filter((o) => o.status === 'new').length
  const ringing = waitingCount > 0
  useEffect(() => {
    if (!ringing) return
    startRinging()
    const topUp = setInterval(startRinging, 60_000)
    return () => {
      clearInterval(topUp)
      stopRinging()
    }
  }, [ringing])

  // When an accepted order's time is up the database moves it on within a minute; the board asks
  // for it as soon as its own clock gets there, so the card moves without waiting.
  const asked = useRef(new Set<string>())
  const dueIds = orders
    .filter((o) => o.status === 'preparing' && o.readyBy && Date.parse(o.readyBy) <= now.getTime())
    .map((o) => o.id)
    .join(',')
  useEffect(() => {
    const fresh = dueIds.split(',').filter((id) => id && !asked.current.has(id))
    if (fresh.length === 0) return
    for (const id of fresh) asked.current.add(id)
    void api.advanceDueOrders().catch(() => undefined)
  }, [dueIds])

  async function enableAlerts() {
    setSound(await unlockSound())
    setPermission(await askNotify())
    playBeep()
  }

  function upsert(order: Order) {
    known.current?.add(order.id)
    setOrders((list) => mergeOrders(list, [order]))
  }

  const q = cleanOrderNumber(toAsciiDigits(query))
  const inScope = orders.filter(
    (o) =>
      (branchFilter === 'all' || o.branchId === branchFilter) &&
      (!date || o.date === date) &&
      (!q || o.number.includes(q) || o.phone.includes(q)),
  )
  const countOf = (f: Filter) => (f === 'all' ? inScope.length : inScope.filter((o) => o.status === f).length)
  // Work queues show the longest-waiting order first; history views show the latest first.
  const oldestFirst = filter === 'new' || filter === 'preparing' || filter === 'out_for_delivery'
  const visible = (filter === 'all' ? inScope : inScope.filter((o) => o.status === filter))
    .slice()
    .sort((a, b) => (oldestFirst ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)))
  const detail = orders.find((o) => o.id === detailId) ?? null
  const cancelling = orders.find((o) => o.id === cancelId) ?? null

  async function advance(order: Order) {
    const next = nextStatus(order.status)
    if (!next) return
    try {
      upsert(await api.setStatus(order.id, next))
      toast.success(`طلب ${orderLabel(order.number)}: ${statusLabel(next, order.orderType)}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function cancel(order: Order, reason: string) {
    try {
      upsert(await api.setStatus(order.id, 'cancelled', reason))
      setCancelId(null)
      toast.success(`أُلغي الطلب ${orderLabel(order.number)}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <title>{`${waitingCount > 0 ? `(${waitingCount}) طلب جديد · ` : ''}لوحة الكول سنتر | خليها مشاوي`}</title>
      <AdminNav />
      <main id="content" tabIndex={-1} className="outline-none mx-auto grid max-w-[1320px] gap-4 px-5 pt-4 pb-8 md:px-6 lg:px-8">
        {/* The tab already names the screen and the banner already says it is a demo. */}
        <h1 className="sr-only">الطلبات</h1>
        {!sound || permission === 'default' ? (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-ink ring-1 ring-warning-ink/20">
            <BellRing aria-hidden className="size-5 shrink-0" />
            <p className="min-w-48 flex-1">فعّل الصوت والتنبيهات عشان ما يفوتكش طلب جديد، حتى لو إنت على صفحة تانية.</p>
            <Button className="h-11 px-5 max-sm:w-full" onClick={() => void enableAlerts()}>
              تفعيل الصوت والتنبيهات
            </Button>
          </div>
        ) : null}
        {/* One grid for labels, boxes and status buttons. Each field is a subgrid of three rows (label, box,
            caption), so the boxes stay on one line even when a label wraps or only the date has a caption.
            The status buttons sit beside the boxes from 1280px and on their own row below that; on phones that row
            scrolls sideways so the orders start higher. */}
        <div className="grid grid-cols-2 gap-x-3 rounded-[20px] bg-card p-4 shadow-card sm:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          <Field id="f-branch" label="الفرع" className={FIELD_CELL}>
            <SelectInput id="f-branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="all">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="f-date" label="التاريخ" className={FIELD_CELL}>
            <Input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby="f-date-ar" />
            <p id="f-date-ar" className="text-xs font-semibold text-muted-foreground">
              {formatDateAr(date)}
            </p>
          </Field>
          <Field id="f-search" label="بحث برقم الطلب أو الموبايل" className={cn(FIELD_CELL, 'col-span-2 mt-3 sm:col-span-1 sm:mt-0')}>
            <Input id="f-search" type="search" dir="ltr" className="text-end" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <div role="group" aria-label="تصفية حسب الحالة" className="col-span-full mt-1.5 flex flex-wrap gap-2 max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:py-1 max-sm:[scrollbar-width:none] xl:col-span-1 xl:col-start-4 xl:row-start-2 xl:mt-0 xl:self-center">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                variant="outline"
                // Dark when active, so staff filters never look like the orange customer actions.
                className={cn('h-11 shrink-0 bg-control px-4 text-[13px] font-semibold shadow-none', filter === f.value && 'bg-brand bg-none text-band-ink ring-1 ring-gold hover:bg-brand active:bg-brand')}
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label} ({countOf(f.value)})
              </Button>
            ))}
          </div>
        </div>
        {!loaded ? (
          <p aria-busy="true">جاري تحميل الطلبات…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-[20px] bg-card p-8 text-center text-muted-foreground shadow-card">لا توجد طلبات بهذه التصفية.</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 min-[90rem]:grid-cols-3" aria-label="قائمة الطلبات">
            {visible.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} now={now} onAdvance={() => void advance(o)} onCancel={() => setCancelId(o.id)} onOpen={() => setDetailId(o.id)} />
              </li>
            ))}
          </ul>
        )}
      </main>
      {detail ? (
        <OrderDetailsSheet order={detail} onSaved={upsert} onClose={() => setDetailId(null)} onAdvance={() => void advance(detail)} onCancel={() => setCancelId(detail.id)} />
      ) : null}
      {cancelling ? (
        <CancelDialog key={cancelling.id} order={cancelling} onClose={() => setCancelId(null)} onConfirm={(reason) => void cancel(cancelling, reason)} />
      ) : null}
    </>
  )
}
