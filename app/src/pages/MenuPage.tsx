import { ArrowRight, Clock, Search, ShoppingBag, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { CartSheet } from '@/components/CartSheet'
import { CategoryBar } from '@/components/CategoryBar'
import { ItemCard } from '@/components/ItemCard'
import { ItemSheet } from '@/components/ItemSheet'
import { OpenBadge } from '@/components/OpenBadge'
import { PromoStrip } from '@/components/PromoStrip'
import { headerButton } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useNow } from '@/hooks/useNow'
import { cartCount, cartSubtotal } from '@/lib/cart'
import { brand, getMenu, getMenuStrip, type MenuItem } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { formatTimeAr, getOpenStatus } from '@/lib/hours'
import { searchKey } from '@/lib/text'
import { useBranch } from '@/state/branch-context'
import { useCart } from '@/state/cart-context'

/** The gold diamonds and hairlines around a section title. */
function SectionTitle({ id, children }: { id: string; children: string }) {
  const line = 'h-px max-w-[90px] flex-1 from-gold to-transparent'
  const diamond = 'size-[7px] shrink-0 rotate-45 bg-gold'
  return (
    <div className="flex items-center justify-center gap-2 pt-4 pb-2.5 lg:pt-5 lg:pb-3.5">
      <span className={`${line} bg-linear-to-r`} aria-hidden="true" />
      <span className={diamond} aria-hidden="true" />
      <h2 id={id} className="px-1.5 text-[21px] leading-8 font-extrabold lg:text-[28px] lg:leading-10">
        {children}
      </h2>
      <span className={diamond} aria-hidden="true" />
      <span className={`${line} bg-linear-to-l`} aria-hidden="true" />
    </div>
  )
}

/** The menu search, with its own clear button. */
function SearchField({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  return (
    <>
      <Search className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        aria-label="ابحث عن صنف"
        placeholder="ابحث عن صنف…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="peer h-11 w-full rounded-2xl bg-card ps-11 pe-12 text-[15px] ring-1 ring-border outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-gold lg:h-[54px] lg:bg-control"
      />
      {query ? (
        <button
          type="button"
          onClick={(e) => {
            setQuery('')
            ;(e.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus()
          }}
          className="absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none hover:bg-gold-soft hover:text-foreground focus-visible:ring-2 focus-visible:ring-gold"
        >
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">مسح البحث</span>
        </button>
      ) : null}
    </>
  )
}

export function MenuPage() {
  const branch = useBranch()
  const now = useNow()
  const menu = useMemo(() => getMenu(branch.id), [branch.id])
  const { lines, dispatch } = useCart()
  const [selected, setSelected] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [query, setQuery] = useState('')
  const sticky = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const [stickyHeight, setStickyHeight] = useState(56)
  // Once the logo and the search have scrolled away, a slim branch row joins the sticky categories.
  const [collapsed, setCollapsed] = useState(false)

  const wanted = searchKey(query)
  const shown = useMemo(
    () =>
      wanted
        ? menu.map((c) => ({ ...c, items: c.items.filter((i) => searchKey(i.name).includes(wanted)) })).filter((c) => c.items.length > 0)
        : menu,
    [menu, wanted],
  )
  const sectionIds = useMemo(() => shown.map((c) => c.id), [shown])
  const offset = stickyHeight + 8
  const [activeId, selectSection] = useActiveSection(sectionIds, offset)

  // The category bar's real height decides where a section lands under the sticky bars.
  useEffect(() => {
    const el = sticky.current
    if (!el || typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(() => setStickyHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = top.current
    if (!el || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const status = getOpenStatus(branch.hours, now, branch.timezone)
  const closedMessage = status.isOpen
    ? null
    : `الفرع مغلق الآن${status.opensAt ? `، ويفتح ${formatTimeAr(status.opensAt)}` : ''}. تقدر تجهز طلبك وتأكده في مواعيد العمل.`
  const cartButton = (size: string) => (
    <button type="button" className={`${headerButton} ${size} bg-linear-to-br from-[#3a271a] to-brand text-gold-hi ring-0 hover:to-brand-pressed`} onClick={openCart} aria-label={`السلة (${count})`}>
      <ShoppingBag className="size-5" aria-hidden="true" />
      {count > 0 ? (
        <span aria-hidden="true" className="absolute -start-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-gold-hi px-1 text-[11px] leading-[14px] font-extrabold text-brand">
          {count}
        </span>
      ) : null}
    </button>
  )
  const count = cartCount(lines)

  function openCart() {
    toast.dismiss() // an "added to cart" message would sit on top of the cart total
    setCartOpen(true)
  }

  function goToSection(id: string) {
    selectSection(id)
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView?.({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <>
      <title>{`منيو فرع ${branch.name} | خليها مشاوي`}</title>
      <header ref={top} className="mx-auto max-w-[1240px] px-4 md:px-6 lg:px-8">
        {/* Phones: back, logo, branch and cart on one row with the search under it. From 1024px the search sits in that row. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 pt-2.5 pb-1.5 lg:flex-nowrap lg:gap-x-4 lg:pt-3.5">
          <Link to="/" className={headerButton}>
            <ArrowRight className="size-5" aria-hidden="true" />
            <span className="sr-only">كل الفروع</span>
          </Link>
          <img src={brand.logoUrl} alt="خليها مشاوي" width={brand.logoWidth} height={brand.logoHeight} className="h-[50px] w-auto shrink-0 lg:h-[76px]" />
          <div className="grid min-w-0 justify-items-start border-s border-border ps-2.5 leading-tight lg:hidden">
            <span className="text-[11px] font-bold text-muted-foreground" aria-hidden="true">فرع</span>
            <span className="max-w-full truncate font-naskh text-lg font-bold" aria-hidden="true">{branch.name}</span>
            <OpenBadge branch={branch} now={now} className="mt-0.5 bg-transparent p-0 ring-0" />
          </div>
          <div className="relative order-last basis-full lg:order-none lg:basis-auto lg:max-w-[520px] lg:flex-1 lg:mx-auto">
            <SearchField query={query} setQuery={setQuery} />
          </div>
          <div className="ms-auto lg:ms-0">{cartButton('')}</div>
        </div>
        <div className="flex items-center gap-3.5 lg:mt-1.5">
          <h1 className="sr-only lg:not-sr-only lg:text-[34px] lg:leading-[48px] lg:font-extrabold">
            <span className="sr-only">منيو </span>فرع {branch.name}
          </h1>
          <OpenBadge branch={branch} now={now} className="hidden px-3.5 py-1.5 text-[13px] lg:inline-flex" />
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 pb-28 md:px-6 lg:px-8">
        {closedMessage ? (
          <p role="status" className="mt-2 flex items-start gap-2.5 rounded-2xl bg-gold-soft px-3.5 py-3 text-[13px] leading-6 font-bold text-[#4a3420] ring-1 ring-gold">
            <Clock className="mt-0.5 size-[18px] shrink-0 text-gold-deep" aria-hidden="true" />
            {closedMessage}
          </p>
        ) : null}
        <PromoStrip strip={getMenuStrip(branch.id)} />
        <div ref={sticky} className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-4 mt-1 bg-background/95 px-4 backdrop-blur-sm md:-mx-6 md:px-6 lg:mx-0 lg:px-0">
          {collapsed ? (
            <div className="flex items-center gap-2.5 pt-2 lg:hidden">
              <Link to="/" className={`${headerButton} size-[38px] rounded-xl`}>
                <ArrowRight className="size-[18px]" aria-hidden="true" />
                <span className="sr-only">كل الفروع</span>
              </Link>
              <p className="min-w-0 flex-1 truncate font-naskh text-lg font-bold">فرع {branch.name}</p>
              {cartButton('size-[38px] rounded-xl')}
            </div>
          ) : null}
          <CategoryBar categories={shown} activeId={activeId} onSelect={goToSection} />
          {collapsed ? <div className="-mx-4 h-px bg-border md:-mx-6 lg:hidden" /> : null}
        </div>
        {shown.length === 0 ? (
          <div className="grid justify-items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">لا يوجد صنف بهذا الاسم.</p>
            <Button variant="outline" onClick={() => setQuery('')}>
              مسح البحث
            </Button>
          </div>
        ) : null}
        {shown.map((category) => (
          <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`} style={{ scrollMarginTop: offset }}>
            <SectionTitle id={`${category.id}-title`}>{category.name}</SectionTitle>
            <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3 lg:grid-cols-5 lg:gap-3.5 xl:grid-cols-6">
              {category.items.map((item) => (
                <ItemCard key={item.id} item={item} phone={branch.phones[0]} onAdd={() => setSelected(item)} />
              ))}
            </ul>
          </section>
        ))}
      </main>

      {count > 0 ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-30 flex justify-center">
          <button
            type="button"
            onClick={openCart}
            aria-label={`عرض السلة (${count}) · ${formatEGP(cartSubtotal(lines))}`}
            className="pointer-events-auto flex h-[54px] items-center gap-2.5 rounded-full bg-linear-to-l from-[#d8b57a] to-gold ps-2 pe-2 text-[15px] font-extrabold whitespace-nowrap text-brand shadow-[0_12px_26px_rgb(120_85_40/0.35)] outline-none hover:to-gold-deep focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 lg:h-[58px] lg:min-w-[420px] lg:justify-between"
          >
            <span className="relative grid size-10 place-items-center rounded-full bg-brand text-gold-hi">
              <ShoppingBag className="size-5" aria-hidden="true" />
              <span aria-hidden="true" className="absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] text-brand">
                {count}
              </span>
            </span>
            <span className="px-1">عرض السلة</span>
            <span className="rounded-full bg-brand/12 px-3.5 py-2 tabular-nums">{formatEGP(cartSubtotal(lines))}</span>
          </button>
        </div>
      ) : null}

      {selected ? (
        <ItemSheet
          key={selected.id}
          item={selected}
          onClose={() => setSelected(null)}
          onAdd={(size, qty, note) => {
            dispatch({
              type: 'add',
              qty,
              line: { sizeId: size.id, itemId: selected.id, name: selected.name, sizeLabel: size.label, unitPrice: size.price, note },
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
