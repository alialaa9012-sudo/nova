import { MessageSquareText, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cartSubtotal, lineKey } from '@/lib/cart'
import { findSize, type Branch } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { useCart } from '@/state/cart-context'
import { ItemImage } from './ItemImage'
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
            <span className="text-[15px] leading-5 font-extrabold">المجموع</span>
            <span className="text-[22px] leading-[30px] font-extrabold tabular-nums">{formatEGP(cartSubtotal(lines))}</span>
          </p>
          {closedMessage ? <p className="text-sm font-semibold text-danger">{closedMessage}</p> : null}
          {lines.length > 0 && !closedMessage ? (
            <Button asChild size="lg" className="h-14 w-full text-base">
              <Link to={`/branch/${branch.id}/checkout`} onClick={() => onOpenChange(false)}>
                إتمام الطلب
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="h-14 w-full text-base" disabled>
              إتمام الطلب
            </Button>
          )}
        </div>
      }
    >
      {lines.length === 0 ? (
        <div className="grid justify-items-center gap-3 py-6 text-center">
          <p className="text-muted-foreground">السلة فارغة.</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            العودة للمنيو
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-[22px] border border-border bg-card px-3.5">
          {lines.map((l) => {
            const item = findSize(branch.id, l.sizeId)?.item
            const key = lineKey(l)
            return (
              <li key={key} className="flex items-start gap-3 py-3">
                <ItemImage src={item?.thumb ?? item?.image} name={l.name} category={item?.category ?? ''} className="size-[58px] shrink-0 rounded-2xl after:hidden" iconClassName="size-7 stroke-[1.5]" />
                <div className="min-w-0 flex-1">
                  <p className="font-naskh text-[19px] leading-7 font-bold">{l.name}</p>
                  <p className="text-[12.5px] leading-5 text-muted-foreground tabular-nums">
                    {l.sizeLabel ? `${l.sizeLabel} · ` : ''}
                    {formatEGP(l.unitPrice)}
                  </p>
                  {l.note ? (
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-gold-soft px-2.5 py-1.5 text-[12.5px] leading-5 text-[#5a4026]">
                      <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-gold-deep" aria-hidden="true" />
                      <span>
                        <span className="sr-only">ملاحظة: </span>
                        {l.note}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'remove', key })}
                    className="-mt-1.5 -me-1.5 grid size-11 place-items-center rounded-full text-[#9a6a55] outline-none hover:text-danger focus-visible:ring-3 focus-visible:ring-ring/50 active:text-danger"
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
                    <span className="sr-only">حذف {l.name}</span>
                  </button>
                  <QtyStepper
                    compact
                    value={l.qty}
                    onChange={(qty) => dispatch({ type: 'setQty', key, qty })}
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
