import { createElement } from 'react'
import { itemIcon } from '@/lib/itemIcon'
import { cn } from '@/lib/utils'

/**
 * The photo slot of an item. Without a photo it shows the item's sign in the logo's gold,
 * inside a frame shaped like the logo's arch.
 */
export function ItemImage({
  src,
  name,
  category,
  className,
  iconClassName,
  priority = false,
}: {
  src?: string
  name: string
  category: string
  className?: string
  iconClassName?: string
  /** The photo is among the first on screen: fetch it now, ahead of the rest. */
  priority?: boolean
}) {
  return (
    <div
      className={cn(
        'relative grid w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_60%,#fbf1e2,#f1e3cb_75%)] text-gold',
        !src && 'after:pointer-events-none after:absolute after:inset-1.5 after:rounded-t-[14px] after:rounded-b-[40px] after:border after:border-gold/30',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" className="size-full object-cover" />
      ) : (
        createElement(itemIcon(name, category), { className: cn('size-12 stroke-[1.4]', iconClassName), 'aria-hidden': true })
      )}
    </div>
  )
}
