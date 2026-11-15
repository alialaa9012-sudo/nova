import { useState, type FormEvent } from 'react'
import { Hash, Phone, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fieldProps } from '@/lib/a11y'
import { normalizeEgyptianMobile, toAsciiDigits } from '@/lib/phone'
import { fieldGroup, rowInput } from './form-styles'
import { IconField } from './IconField'
import { cn } from '@/lib/utils'

/** Asks for the order number (unless known) and the phone used to place the order. */
export function TrackForm({ fixedNumber, onDone }: { fixedNumber?: string; onDone: (number: string, phone: string) => void }) {
  const [number, setNumber] = useState(fixedNumber ?? '')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<{ number?: string; phone?: string }>({})

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const n = toAsciiDigits(number).trim().toUpperCase()
    const p = normalizeEgyptianMobile(phone)
    const found = {
      number: /^[A-Z]-\d{4}$/.test(n) ? undefined : 'اكتب رقم الطلب كما وصلك، مثل A-0012.',
      phone: p ? undefined : 'اكتب رقم الموبايل الذي طلبت به.',
    }
    setErrors(found)
    if (found.number) document.getElementById('order-number')?.focus()
    else if (found.phone) document.getElementById('track-phone')?.focus()
    else if (p) onDone(n, p)
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-3.5">
      <div className={fieldGroup}>
        {fixedNumber ? null : (
          <IconField id="order-number" label="رقم الطلب" icon={Hash} error={errors.number}>
            <input
              {...fieldProps('order-number', errors.number)}
              dir="ltr"
              placeholder="A-0012"
              value={number}
              onChange={(e) => {
                setNumber(e.target.value)
                setErrors((x) => ({ ...x, number: undefined }))
              }}
              className={cn(rowInput, 'text-end tracking-wide')}
            />
          </IconField>
        )}
        <IconField id="track-phone" label="رقم الموبايل" icon={Phone} error={errors.phone}>
          <input
            {...fieldProps('track-phone', errors.phone)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setErrors((x) => ({ ...x, phone: undefined }))
            }}
            className={cn(rowInput, 'text-end tabular-nums')}
          />
        </IconField>
      </div>
      <Button type="submit" size="lg" className="h-14 w-full text-base">
        <Search aria-hidden="true" /> عرض حالة الطلب
      </Button>
    </form>
  )
}
