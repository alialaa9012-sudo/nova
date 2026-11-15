import { Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The 4:3 photo slot of an item. Without a photo (only in sections where other items have one)
 * it shows a quiet placeholder framed in the logo's gold.
 */
export function ItemImage({ src, className }: { src?: string; className?: string }) {
  return (
    <div className={cn('grid aspect-[4/3] w-full place-items-center overflow-hidden bg-brand-tint', className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <span className="grid size-14 place-items-center rounded-t-full rounded-b-xl border border-gold/70">
          <Utensils className="size-6 text-gold-deep/70" aria-hidden="true" />
        </span>
      )}
    </div>
  )
}
