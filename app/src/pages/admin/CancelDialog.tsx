import { useState } from 'react'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { Order } from '@/lib/api'
import { CANCEL_REASONS } from '@/lib/orderStatus'

const OTHER = 'سبب آخر'

export function CancelDialog({ order, onClose, onConfirm }: { order: Order; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const extra = note.trim()
  const finalReason = reason === OTHER ? extra : reason && extra ? `${reason}: ${extra}` : reason

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            إلغاء الطلب <span dir="ltr">{order.number}</span>
          </DialogTitle>
          <DialogDescription>اختر سبب الإلغاء. يُسجَّل السبب ووقت الإلغاء في سجل الطلب.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={setReason} aria-label="سبب الإلغاء" className="grid gap-2">
          {CANCEL_REASONS.map((r, i) => (
            <Label key={r} htmlFor={`reason-${i}`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3">
              <RadioGroupItem id={`reason-${i}`} value={r} />
              {r}
            </Label>
          ))}
        </RadioGroup>
        <Field id="cancel-note" label={reason === OTHER ? 'اكتب السبب' : 'تفاصيل إضافية'} optional={reason !== OTHER}>
          <Textarea id="cancel-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            تراجع
          </Button>
          <Button className="bg-red-700 text-white hover:bg-red-800" disabled={!finalReason} onClick={() => onConfirm(finalReason)}>
            تأكيد الإلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
