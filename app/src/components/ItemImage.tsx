import { Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The 4:3 photo slot of an item. Without a photo it shows the same neutral placeholder everywhere. */
export function ItemImage({ src, className }: { src?: string; className?: string }) {
  return (
    <div className={cn('grid aspect-[4/3] w-full place-items-center overflow-hidden bg-brand-tint', className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <Utensils className="size-8 text-brand-soft" aria-hidden="true" />
      )}
    </div>
  )
}
