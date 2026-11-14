import { useState } from 'react'
import { RadioGroup } from 'radix-ui'
import { Button } from '@/components/ui/button'
import type { MenuItem, MenuSize } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
import { ModalSheet } from './ModalSheet'
import { QtyStepper } from './QtyStepper'

export function ItemSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem
  onClose: () => void
  onAdd: (size: MenuSize, qty: number) => void
}) {
  const [sizeId, setSizeId] = useState(item.sizes[0].id)
  const [qty, setQty] = useState(1)
  const size = item.sizes.find((s) => s.id === sizeId) ?? item.sizes[0]

  return (
    <ModalSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={item.name}
      description={item.description || 'اختر الكمية وأضف الصنف إلى السلة.'}
      image={item.image}
      footer={
        <div className="flex items-center gap-3">
          <QtyStepper value={qty} onChange={setQty} />
          <Button size="lg" className="min-w-0 flex-1 px-4 shadow-cta" onClick={() => onAdd(size, qty)}>
            أضف للسلة · {formatEGP(size.price * qty)}
          </Button>
        </div>
      }
    >
      {item.sizes.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-[13px] leading-[18px] font-semibold">الحجم</legend>
          {/* Each chip is the radio itself, so the choice works the same with a keyboard or a screen reader. */}
          <RadioGroup.Root value={sizeId} onValueChange={setSizeId} className="flex flex-wrap gap-2">
            {item.sizes.map((s) => (
              <RadioGroup.Item
                key={s.id}
                value={s.id}
                className="flex h-14 min-w-[76px] flex-col items-center justify-center rounded-2xl bg-chip px-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              >
                <span className="text-sm leading-5 font-semibold">{s.label}</span>
                <span className="text-xs leading-4 tabular-nums">{formatEGP(s.price)}</span>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </fieldset>
      ) : null}
    </ModalSheet>
  )
}
