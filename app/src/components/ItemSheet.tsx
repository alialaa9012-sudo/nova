import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { MenuItem, MenuSize } from '@/lib/catalog'
import { formatEGP } from '@/lib/format'
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
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90svh] max-w-2xl overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl">{item.name}</SheetTitle>
          <SheetDescription>{item.description || 'اختر الكمية وأضف الصنف إلى السلة.'}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4">
          {item.sizes.length > 1 ? (
            <fieldset className="grid gap-2">
              <legend className="mb-2 font-semibold">الحجم</legend>
              <RadioGroup value={sizeId} onValueChange={setSizeId} className="grid gap-2">
                {item.sizes.map((s) => (
                  <Label
                    key={s.id}
                    htmlFor={s.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary"
                  >
                    <span className="flex items-center gap-3">
                      <RadioGroupItem id={s.id} value={s.id} />
                      <span className="text-base">{s.label}</span>
                    </span>
                    <span className="font-bold text-brand">{formatEGP(s.price)}</span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="font-semibold">الكمية</span>
            <QtyStepper value={qty} onChange={setQty} />
          </div>
        </div>
        <SheetFooter>
          <Button size="lg" className="h-12 text-base" onClick={() => onAdd(size, qty)}>
            أضف للسلة · {formatEGP(size.price * qty)}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
