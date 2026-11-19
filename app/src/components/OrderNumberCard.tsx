import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'
import { brand } from '@/lib/catalog'
import { orderLabel } from '@/lib/orderNumber'

/** The order number in the dark band, with copy and WhatsApp share. */
export function OrderNumberCard({ number: raw }: { number: string }) {
  const number = orderLabel(raw)
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
    "relative grid size-11 place-items-center rounded-xl bg-white/8 text-band-ink ring-1 ring-gold-hi/40 outline-none after:absolute after:-inset-[3px] after:content-[''] hover:bg-white/14 focus-visible:ring-3 focus-visible:ring-gold-hi/70"
  return (
    // A glass card: the one place the number is shown, large enough to read out on the phone.
    <div className="flex items-center gap-2.5 rounded-[20px] bg-white/7 px-4 py-3.5 ring-1 ring-gold-hi/35 backdrop-blur-sm lg:px-5 lg:py-4">
      <p className="grid flex-1 leading-tight">
        <span className="text-xs text-band-muted">رقم طلبك</span>
        <span id="order-number-value" dir="ltr" className="text-end text-[30px] leading-10 font-extrabold tracking-wide text-gold-hi tabular-nums lg:text-[34px]">
          {number}
        </span>
      </p>
      <button type="button" onClick={() => void copy()} aria-label="نسخ رقم الطلب" className={action}>
        {copied ? <Check className="size-[18px] text-gold-hi" aria-hidden="true" /> : <Copy className="size-[18px]" aria-hidden="true" />}
      </button>
      <a href={share} target="_blank" rel="noopener noreferrer" aria-label="مشاركة رقم الطلب على واتساب" className={action}>
        <Share2 className="size-[18px]" aria-hidden="true" />
      </a>
      <p role="status" className="sr-only">
        {copied ? 'نُسخ رقم الطلب' : ''}
      </p>
    </div>
  )
}
