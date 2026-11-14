import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cartSubtotal } from '@/lib/cart'
import { findSize, type Branch } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { useCart } from '@/state/cart-context'
import { ModalSheet } from './ModalSheet'
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
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      title="السلة"
      description={`فرع ${branch.name}`}
      footer={
        <div className="grid gap-3">
          <p className="flex items-center justify-between">
            <span className="text-sm leading-5 text-muted-foreground">المجموع</span>
            <span className="text-lg leading-[26px] font-extrabold tabular-nums">{formatEGP(cartSubtotal(lines))}</span>
          </p>
          {closedMessage ? <p className="text-sm font-semibold text-red-700">{closedMessage}</p> : null}
          {lines.length > 0 && !closedMessage ? (
            <Button asChild size="lg" className="w-full shadow-cta">
              <Link to={`/branch/${branch.id}/checkout`} onClick={() => onOpenChange(false)}>
                إتمام الطلب
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="w-full" disabled>
              إتمام الطلب
            </Button>
          )}
        </div>
      }
    >
      {lines.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">السلة فارغة.</p>
      ) : (
        <ul className="divide-y divide-brand-tint">
          {lines.map((l) => {
            const image = findSize(branch.id, l.sizeId)?.item.image
            return (
              <li key={l.sizeId} className="flex gap-3 py-3">
                {image ? <img src={image} alt="" className="size-14 shrink-0 rounded-xl object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-[22px] font-bold">
                    {l.name}
                    {l.sizeLabel ? ` (${l.sizeLabel})` : ''}
                  </p>
                  <p className="mt-1 text-sm leading-5 font-bold tabular-nums">{formatEGP(l.unitPrice * l.qty)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'remove', sizeId: l.sizeId })}
                    className="-mt-2 -me-2 grid size-11 place-items-center rounded-full text-muted-foreground outline-none hover:text-red-700 focus-visible:ring-3 focus-visible:ring-ring/50 active:text-red-700"
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
                    <span className="sr-only">حذف {l.name}</span>
                  </button>
                  <QtyStepper
                    compact
                    value={l.qty}
                    onChange={(qty) => dispatch({ type: 'setQty', sizeId: l.sizeId, qty })}
                    decreaseLabel={`تقليل كمية ${l.name}`}
                    increaseLabel={`زيادة كمية ${l.name}`}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </ModalSheet>
  )
}
