import { Search, ShoppingBag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CartSheet } from '@/components/CartSheet'
import { CategoryBar } from '@/components/CategoryBar'
import { ItemCard } from '@/components/ItemCard'
import { ItemSheet } from '@/components/ItemSheet'
import { OpenBadge } from '@/components/OpenBadge'
import { PromoStrip } from '@/components/PromoStrip'
import { headerButton, SiteHeader } from '@/components/SiteHeader'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useNow } from '@/hooks/useNow'
import { cartCount, cartSubtotal } from '@/lib/cart'
import { getMenu, getMenuStrip, type MenuItem } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { formatTimeAr, getOpenStatus } from '@/lib/hours'
import { searchKey } from '@/lib/text'
import { useBranch } from '@/state/branch-context'
import { useCart } from '@/state/cart-context'

/** Height covered by the sticky header and category bar, in pixels. */
const STICKY_OFFSET = 132

export function MenuPage() {
  const branch = useBranch()
  const now = useNow()
  const menu = useMemo(() => getMenu(branch.id), [branch.id])
  const { lines, dispatch } = useCart()
  const [selected, setSelected] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [query, setQuery] = useState('')

  const wanted = searchKey(query)
  const shown = useMemo(
    () =>
      wanted
        ? menu.map((c) => ({ ...c, items: c.items.filter((i) => searchKey(i.name).includes(wanted)) })).filter((c) => c.items.length > 0)
        : menu,
    [menu, wanted],
  )
  const sectionIds = useMemo(() => shown.map((c) => c.id), [shown])
  const activeId = useActiveSection(sectionIds, STICKY_OFFSET)

  const status = getOpenStatus(branch.hours, now, branch.timezone)
  const closedMessage = status.isOpen
    ? null
    : `الفرع مغلق الآن${status.opensAt ? `، ويفتح ${formatTimeAr(status.opensAt)}` : ''}. تقدر تجهز طلبك وتأكده في مواعيد العمل.`
  const count = cartCount(lines)

  function openCart() {
    toast.dismiss() // an "added to cart" message would sit on top of the cart total
    setCartOpen(true)
  }

  function goToSection(id: string) {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView?.({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <>
      <title>{`منيو فرع ${branch.name} | خليها مشاوي`}</title>
      <SiteHeader backTo="/" backLabel="كل الفروع" title={`فرع ${branch.name}`}>
        <button type="button" className={headerButton} onClick={openCart} aria-label={`السلة (${count})`}>
          <ShoppingBag className="size-5" aria-hidden="true" />
          {count > 0 ? (
            <span aria-hidden="true" className="absolute -end-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] leading-[14px] font-bold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </button>
      </SiteHeader>
      <main className="mx-auto max-w-[1200px] px-5 pb-28 md:px-6">
        <h1 className="sr-only">منيو فرع {branch.name}</h1>
        <OpenBadge branch={branch} now={now} />
        {closedMessage ? (
          <p role="status" className="mt-3 rounded-2xl bg-stone-200 p-3 text-sm font-semibold text-stone-900">
            {closedMessage}
          </p>
        ) : null}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="menu-search"
            type="search"
            aria-label="ابحث عن صنف"
            placeholder="ابحث عن صنف…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-full bg-control ps-12 pe-4 text-base shadow-card outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
        <PromoStrip strip={getMenuStrip(branch.id)} />
        <div className="sticky top-[calc(68px+env(safe-area-inset-top,0px))] z-20 mt-1 bg-background">
          <CategoryBar categories={shown} activeId={activeId} onSelect={goToSection} />
        </div>
        {shown.length === 0 ? <p className="py-10 text-center text-muted-foreground">لا يوجد صنف بهذا الاسم.</p> : null}
        {shown.map((category) => (
          <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`} className="scroll-mt-[132px] pt-6 first-of-type:pt-3">
            <h2 id={`${category.id}-title`} className="mb-3 text-lg leading-[26px] font-bold">
              {category.name}
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {category.items.map((item) => (
                <ItemCard key={item.id} item={item} phone={branch.phones[0]} onAdd={() => setSelected(item)} />
              ))}
            </ul>
          </section>
        ))}
      </main>

      {count > 0 ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-30">
          <button
            type="button"
            onClick={openCart}
            aria-label={`عرض السلة (${count}) · ${formatEGP(cartSubtotal(lines))}`}
            className="pointer-events-auto mx-auto flex h-14 w-full max-w-xl items-center justify-between gap-3 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground shadow-cta outline-none hover:bg-brand-pressed focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 active:bg-brand-pressed"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5" aria-hidden="true" /> عرض السلة ({count})
            </span>
            <span className="text-base font-extrabold tabular-nums">{formatEGP(cartSubtotal(lines))}</span>
          </button>
        </div>
      ) : null}

      {selected ? (
        <ItemSheet
          key={selected.id}
          item={selected}
          onClose={() => setSelected(null)}
          onAdd={(size, qty) => {
            dispatch({
              type: 'add',
              qty,
              line: { sizeId: size.id, itemId: selected.id, name: selected.name, sizeLabel: size.label, unitPrice: size.price },
            })
            toast.success(`أُضيف ${selected.name}${size.label ? ` (${size.label})` : ''} إلى السلة`)
            setSelected(null)
          }}
        />
      ) : null}
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} branch={branch} closedMessage={closedMessage} />
    </>
  )
}
