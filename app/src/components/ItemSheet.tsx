import { MessageSquareText, PencilLine } from 'lucide-react'
import { useState } from 'react'
import { RadioGroup } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { MAX_NOTE } from '@/lib/cart'
import type { MenuItem, MenuSize } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { ItemImage } from './ItemImage'
import { ModalSheet } from './ModalSheet'
import { QtyStepper } from './QtyStepper'

/** The picture at the top: the photo, or the item's sign under an arch like the logo's frame. */
function Hero({ item }: { item: MenuItem }) {
  if (item.image) return <img src={item.image} alt="" className="h-[220px] w-full object-cover" />
  return (
    <div className="relative">
      <ItemImage name={item.name} category={item.category} className="h-[190px] bg-[radial-gradient(circle_at_50%_65%,#fbf1e2,#eeddc2_80%)]" iconClassName="size-[70px] stroke-[1.2]" />
      <span className="pointer-events-none absolute bottom-0 left-1/2 h-[150px] w-[170px] -translate-x-1/2 rounded-t-full border border-b-0 border-gold/50" aria-hidden="true" />
    </div>
  )
}

export function ItemSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem
  onClose: () => void
  onAdd: (size: MenuSize, qty: number, note: string) => void
}) {
  const [sizeId, setSizeId] = useState(item.sizes[0].id)
  const [qty, setQty] = useState(1)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const size = item.sizes.find((s) => s.id === sizeId) ?? item.sizes[0]

  return (
    <ModalSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={item.name}
      titleClassName="font-naskh text-[28px] leading-10"
      description={item.description || 'اختر الكمية وأضف الصنف إلى السلة.'}
      hero={<Hero item={item} />}
      footer={
        <div className="flex items-center gap-3">
          <QtyStepper value={qty} onChange={setQty} />
          <Button size="lg" className="min-w-0 flex-1 px-4" onClick={() => onAdd(size, qty, note)}>
            أضف للسلة · <span className="text-gold-hi tabular-nums">{formatEGP(size.price * qty)}</span>
          </Button>
        </div>
      }
    >
      {item.sizes.length > 1 ? (
        <fieldset>
          <legend className="mb-2.5 flex w-full items-center gap-2.5 text-[15px] leading-5 font-extrabold after:h-px after:flex-1 after:bg-linear-to-l after:from-gold after:to-transparent">الحجم</legend>
          {/* Each card is the radio itself, so the choice works the same with a keyboard or a screen reader. */}
          <RadioGroup.Root value={sizeId} onValueChange={setSizeId} className="grid grid-cols-2 gap-2">
            {item.sizes.map((s) => (
              <RadioGroup.Item
                key={s.id}
                value={s.id}
                className="group flex h-14 items-center justify-between rounded-2xl bg-card px-3.5 ring-1 ring-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:bg-linear-to-br data-[state=checked]:from-[#3a271a] data-[state=checked]:to-brand data-[state=checked]:text-primary-foreground data-[state=checked]:ring-[1.5px] data-[state=checked]:ring-gold"
              >
                <span className="font-naskh text-xl leading-none font-bold">{s.label}</span>
                <span className="text-sm leading-5 font-extrabold tabular-nums group-data-[state=checked]:text-gold-hi">{formatEGP(s.price)}</span>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </fieldset>
      ) : null}
      {noteOpen ? (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <MessageSquareText className="size-[18px] text-gold-deep" aria-hidden="true" />
            <label htmlFor="item-note" className="text-sm leading-5 font-extrabold">
              ملاحظة على الصنف <span className="font-normal text-muted-foreground">(اختياري)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setNote('')
                setNoteOpen(false)
              }}
              className="ms-auto rounded-lg px-2 py-1 text-[13px] font-bold text-danger outline-none hover:bg-danger-soft focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              حذف <span className="sr-only">الملاحظة</span>
            </button>
          </div>
          <div className="relative mt-2">
            <textarea
              id="item-note"
              autoFocus
              rows={2}
              maxLength={MAX_NOTE}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby="item-note-count"
              className="block min-h-[84px] w-full resize-none rounded-2xl border-2 border-gold bg-surface px-3.5 pt-3 pb-6 text-[15px] leading-6 outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            />
            <span id="item-note-count" className="pointer-events-none absolute start-3.5 bottom-2 text-[11px] text-muted-foreground tabular-nums" dir="ltr">
              {note.length} / {MAX_NOTE}
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="mt-4 flex h-[50px] w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-gold/70 px-3.5 text-[14.5px] font-extrabold text-[#3a271a] outline-none hover:bg-gold-soft focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PencilLine className="size-[18px] text-gold-deep" aria-hidden="true" />
          أضف ملاحظة على الصنف
          <span className="ms-auto text-xs font-bold text-muted-foreground">(اختياري)</span>
        </button>
      )}
    </ModalSheet>
  )
}
