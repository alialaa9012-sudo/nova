import { Phone, Plus, ShoppingBag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CartSheet } from '@/components/CartSheet'
import { ItemSheet } from '@/components/ItemSheet'
import { OpenBadge } from '@/components/OpenBadge'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/useNow'
import { cartCount, cartSubtotal } from '@/lib/cart'
import { getMenu, type MenuItem } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { formatTimeAr, getOpenStatus } from '@/lib/hours'
import { useBranch } from '@/state/branch-context'
import { useCart } from '@/state/cart-context'

function itemPrice(item: MenuItem): string {
  const prices = item.sizes.map((s) => s.price)
  return item.sizes.length > 1 ? `من ${formatEGP(Math.min(...prices))}` : formatEGP(prices[0])
}

export function MenuPage() {
  const branch = useBranch()
  const now = useNow()
  const menu = useMemo(() => getMenu(branch.id), [branch.id])
  const { lines, dispatch } = useCart()
  const [selected, setSelected] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)

  const status = getOpenStatus(branch.hours, now, branch.timezone)
  const closedMessage = status.isOpen
    ? null
    : `الفرع مغلق الآن${status.opensAt ? `، ويفتح ${formatTimeAr(status.opensAt)}` : ''}. تقدر تجهز طلبك وتأكده في مواعيد العمل.`
  const count = cartCount(lines)

  return (
    <>
      <title>{`منيو فرع ${branch.name} | خليها مشاوي`}</title>
      <SiteHeader backTo="/" backLabel="كل الفروع" title={`فرع ${branch.name}`} />
      <div className="sticky top-[72px] z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl gap-2 px-4 py-2">
          <OpenBadge branch={branch} now={now} />
          <nav aria-label="أقسام المنيو" className="-mx-4 overflow-x-auto px-4 pb-1">
            <ul className="flex w-max gap-2">
              {menu.map((c) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="block rounded-full border bg-card px-3 py-1.5 text-sm font-semibold whitespace-nowrap hover:bg-muted">
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-4 pb-32">
        <h1 className="sr-only">منيو فرع {branch.name}</h1>
        {closedMessage ? (
          <p role="status" className="mt-4 rounded-lg bg-stone-200 p-3 text-sm font-semibold text-stone-900">
            {closedMessage}
          </p>
        ) : null}
        {menu.map((category) => (
          <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`} className="scroll-mt-44 pt-6">
            <h2 id={`${category.id}-title`} className="mb-3 text-xl font-extrabold">
              {category.name}
            </h2>
            <ul className="divide-y rounded-xl border bg-card">
              {category.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.name}</p>
                    {item.description ? <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p> : null}
                    <p className="mt-1 text-sm font-bold text-brand">{itemPrice(item)}</p>
                    {item.advanceNoticeHours ? (
                      <p className="mt-1 text-xs font-semibold text-stone-700">بالحجز المسبق قبل {item.advanceNoticeHours} ساعة عبر الهاتف</p>
                    ) : null}
                  </div>
                  {item.advanceNoticeHours ? (
                    <Button asChild variant="outline" className="h-11">
                      <a href={`tel:${branch.phones[0]}`}>
                        <Phone aria-hidden="true" /> احجز{' '}
                        <span className="sr-only">{item.name}</span>
                      </a>
                    </Button>
                  ) : (
                    <Button className="h-11" onClick={() => setSelected(item)}>
                      <Plus aria-hidden="true" /> أضف{' '}
                      <span className="sr-only">{item.name}</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <Button size="lg" className="h-12 w-full text-base" onClick={() => setCartOpen(true)}>
              <ShoppingBag aria-hidden="true" /> عرض السلة ({count}) · {formatEGP(cartSubtotal(lines))}
            </Button>
          </div>
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
