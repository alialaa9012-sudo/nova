import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cartSubtotal } from '@/lib/cart'
import type { Branch } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { useCart } from '@/state/cart-context'
import { QtyStepper } from './QtyStepper'

export function CartSheet({
  open,
  onOpenChange,
  branch,
  closedMessage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: Branch
  closedMessage: string | null
}) {
  const { lines, dispatch } = useCart()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90svh] max-w-2xl overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl">السلة</SheetTitle>
          <SheetDescription>فرع {branch.name}</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          {lines.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">السلة فارغة.</p>
          ) : (
            <ul className="divide-y">
              {lines.map((l) => (
                <li key={l.sizeId} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {l.name}
                      {l.sizeLabel ? ` (${l.sizeLabel})` : ''}
                    </p>
                    <p className="text-sm font-semibold text-brand">{formatEGP(l.unitPrice * l.qty)}</p>
                  </div>
                  <QtyStepper
                    value={l.qty}
                    onChange={(qty) => dispatch({ type: 'setQty', sizeId: l.sizeId, qty })}
                    decreaseLabel={`تقليل كمية ${l.name}`}
                    increaseLabel={`زيادة كمية ${l.name}`}
                  />
                  <Button variant="ghost" size="icon-lg" className="size-11" onClick={() => dispatch({ type: 'remove', sizeId: l.sizeId })}>
                    <Trash2 aria-hidden="true" />
                    <span className="sr-only">حذف {l.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <SheetFooter className="gap-3">
          <p className="flex justify-between text-base font-bold">
            <span>المجموع</span>
            <span className="tabular-nums">{formatEGP(cartSubtotal(lines))}</span>
          </p>
          {closedMessage ? <p className="text-sm font-semibold text-red-700">{closedMessage}</p> : null}
          {lines.length > 0 && !closedMessage ? (
            <Button asChild size="lg" className="h-12 text-base">
              <Link to={`/branch/${branch.id}/checkout`} onClick={() => onOpenChange(false)}>
                إتمام الطلب
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="h-12 text-base" disabled>
              إتمام الطلب
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
