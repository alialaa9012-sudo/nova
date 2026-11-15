import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'
import { brand } from '@/lib/catalog'

/** The order number, large, under an arch taken from the logo frame, with copy and WhatsApp share. */
export function OrderNumberCard({ number }: { number: string }) {
  const [copied, setCopied] = useState(false)
  const share = `https://wa.me/?text=${encodeURIComponent(`رقم طلبي من ${brand.name}: ${number}`)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: select the number so the customer can copy it by hand.
      const el = document.getElementById('order-number-value')
      if (el) window.getSelection()?.selectAllChildren(el)
    }
  }

  const action =
    'inline-flex h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-bold text-foreground shadow-card outline-none hover:bg-control focus-visible:ring-3 focus-visible:ring-ring/50'
  return (
    <div className="grid justify-items-center gap-3 rounded-t-[96px] rounded-b-[20px] border border-gold bg-card px-4 pt-7 pb-4 text-center">
      <p className="text-sm text-muted-foreground">رقم طلبك</p>
      <p id="order-number-value" dir="ltr" className="text-[40px] leading-none font-extrabold tracking-wide tabular-nums">
        {number}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => void copy()} aria-label="نسخ رقم الطلب" className={action}>
          {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? 'نُسخ' : 'نسخ'}
        </button>
        <a href={share} target="_blank" rel="noopener noreferrer" aria-label="مشاركة رقم الطلب على واتساب" className={action}>
          <Share2 className="size-4" aria-hidden="true" /> مشاركة
        </a>
      </div>
      <p role="status" className="sr-only">
        {copied ? 'نُسخ رقم الطلب' : ''}
      </p>
    </div>
  )
}
