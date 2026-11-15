import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * The window used for an item and for the cart: a sheet rising from the bottom on phones,
 * a centred dialog from 768px. The footer stays visible while the body scrolls.
 */
export function ModalSheet({
  open,
  onOpenChange,
  title,
  description,
  hero,
  titleClassName,
  footer,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  /** Optional picture across the top (the item photo or its framed sign); the sheet overlaps its lower edge. */
  hero?: ReactNode
  titleClassName?: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1e140d]/45 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-card text-foreground shadow-nav outline-none',
            'md:inset-0 md:m-auto md:h-fit md:max-w-[480px] md:rounded-[28px]',
            'duration-200 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10',
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {hero}
            <div className={cn('relative bg-card', hero && '-mt-7 rounded-t-[28px]')}>
              <div className={cn('grid gap-1 px-5 pt-6', !hero && 'pe-[4.5rem]')}>
                <Dialog.Title className={cn('text-xl leading-7 font-bold', titleClassName)}>{title}</Dialog.Title>
                <Dialog.Description className="text-[13px] leading-5 text-muted-foreground">{description}</Dialog.Description>
              </div>
              <div className="px-5 pt-4 pb-5">{children}</div>
            </div>
          </div>
          {footer ? <div className="shrink-0 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">{footer}</div> : null}
          <Dialog.Close className="absolute end-3 top-4 grid size-11 place-items-center rounded-full bg-card/95 ring-1 ring-border shadow-card outline-none hover:bg-brand-tint focus-visible:ring-3 focus-visible:ring-ring/50">
            <XIcon className="size-5" aria-hidden="true" />
            <span className="sr-only">إغلاق</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
