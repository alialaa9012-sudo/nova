import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fieldProps } from '@/lib/a11y'
import { normalizeEgyptianMobile, toAsciiDigits } from '@/lib/phone'
import { Field } from './Field'

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
    <form noValidate onSubmit={submit} className="grid gap-4">
      {fixedNumber ? null : (
        <Field id="order-number" label="رقم الطلب" error={errors.number}>
          <Input
            {...fieldProps('order-number', errors.number)}
            dir="ltr"
            className="text-end"
            placeholder="A-0012"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>
      )}
      <Field id="track-phone" label="رقم الموبايل" error={errors.phone}>
        <Input
          {...fieldProps('track-phone', errors.phone)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          className="text-end"
          placeholder="01XXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full">
        عرض حالة الطلب
      </Button>
    </form>
  )
}
