import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { OrderSummary } from '@/components/OrderSummary'
import { StatusTimeline } from '@/components/StatusTimeline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { api, errorMessage, type Order } from '@/lib/api'
import { getBranch } from '@/lib/catalog'
import { formatCairoDateTime } from '@/lib/format'
import { nextStatus, statusLabel } from '@/lib/orderStatus'
import { orderText } from '@/lib/orderText'

export function OrderDetailsSheet({
  order,
  onClose,
  onAdvance,
  onCancel,
}: {
  order: Order
  onClose: () => void
  onAdvance: () => void
  onCancel: () => void
}) {
  const branch = getBranch(order.branchId)
  const next = nextStatus(order.status)
  const [invoice, setInvoice] = useState(order.posInvoiceNo ?? '')

  async function saveInvoice() {
    try {
      await api.setPosInvoice(order.id, invoice)
      toast.success('حُفظ رقم الفاتورة')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(orderText(order))
      toast.success('نُسخ الطلب، الصقه في الكاشير')
    } catch {
      toast.error('تعذّر النسخ من المتصفح')
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-xl">
            طلب <span dir="ltr">{order.number}</span>
          </SheetTitle>
          <SheetDescription>
            فرع {branch?.name} · {order.orderType === 'delivery' ? 'توصيل' : 'استلام من الفرع'} · {formatCairoDateTime(order.createdAt)}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6">
          <section className="grid gap-1 text-sm">
            <h3 className="mb-1 text-base font-bold">العميل</h3>
            <p className="font-semibold">{order.customerName}</p>
            <a href={`tel:${order.phone}`} dir="ltr" className="w-fit underline">
              {order.phone}
            </a>
            {order.orderType === 'delivery' ? (
              <>
                <p>المنطقة: {order.zoneLabel}</p>
                <p>
                  {order.street} · عمارة {order.building}
                  {order.apartment ? ` · شقة ${order.apartment}` : ''}
                </p>
                {order.landmark ? <p>علامة مميزة: {order.landmark}</p> : null}
              </>
            ) : null}
            {order.notes ? <p className="rounded-md bg-amber-50 p-2 text-amber-950">ملاحظات: {order.notes}</p> : null}
          </section>
          <section className="grid gap-2">
            <h3 className="text-base font-bold">الأصناف</h3>
            <OrderSummary
              lines={order.lines.map((l, i) => ({ key: String(i), ...l }))}
              totals={order.totals}
              orderType={order.orderType}
              taxPercent={branch?.charges.tax_percent ?? 0}
              servicePercent={branch?.charges.service_percent ?? 0}
            />
          </section>
          <section className="grid gap-2">
            <h3 className="text-base font-bold">سجل الحالة</h3>
            <StatusTimeline order={order} />
          </section>
          <section className="grid gap-3">
            <h3 className="text-base font-bold">الكاشير</h3>
            <Button variant="outline" className="w-fit" onClick={() => void copy()}>
              <Copy aria-hidden="true" /> نسخ الطلب
            </Button>
            <Field id="pos-invoice" label="رقم الفاتورة في Crystal Mind" optional>
              <div className="flex gap-2">
                <Input id="pos-invoice" dir="ltr" className="h-10 text-start" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
                <Button variant="outline" onClick={() => void saveInvoice()}>
                  حفظ
                </Button>
              </div>
            </Field>
          </section>
          <div className="flex flex-wrap gap-2">
            {next ? <Button onClick={onAdvance}>{`نقل إلى: ${statusLabel(next, order.orderType)}`}</Button> : null}
            {order.status !== 'cancelled' ? (
              <Button variant="outline" className="text-red-700" onClick={onCancel}>
                إلغاء الطلب
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
