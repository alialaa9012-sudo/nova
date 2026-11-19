import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fieldProps } from '@/lib/a11y'
import { cleanOrderNumber } from '@/lib/orderNumber'
import { normalizeEgyptianMobile, toAsciiDigits } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { fieldGroup, rowInput } from './form-styles'
import { IconField } from './IconField'

export type TrackQuery = { number: string; phone?: undefined } | { phone: string; number?: undefined }

/**
 * One field: the order number (#12, 12 or an older A-0012) or the phone the order was placed with,
 * so a customer who lost the number can still find the order. onDone answers with an error to show,
 * or null once it has moved on.
 */
export function TrackForm({ onDone }: { onDone: (query: TrackQuery) => Promise<string | null> }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const phone = normalizeEgyptianMobile(value)
    const number = cleanOrderNumber(toAsciiDigits(value))
    let problem: string | null
    if (phone) problem = null
    else if (!/^(\d{1,4}|[A-Z]-\d{4})$/.test(number)) problem = 'اكتب رقم الطلب كما وصلك، مثل #12، أو رقم الموبايل الذي طلبت به.'
    else problem = null
    if (!problem) {
      setBusy(true)
      problem = await onDone(phone ? { phone } : { number })
      setBusy(false)
    }
    setError(problem ?? undefined)
    if (problem) document.getElementById('track-query')?.focus()
  }

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-3.5">
      <div className={fieldGroup}>
        <IconField id="track-query" label="رقم الطلب أو رقم الموبايل" icon={Search} error={error}>
          <input
            {...fieldProps('track-query', error)}
            inputMode="tel"
            dir="ltr"
            placeholder="#12  أو  01XXXXXXXXX"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(undefined)
            }}
            className={cn(rowInput, 'text-end tracking-wide tabular-nums')}
          />
        </IconField>
      </div>
      <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={busy}>
        <Search aria-hidden="true" /> عرض حالة الطلب
      </Button>
    </form>
  )
}
