import { House, MessageCircle, PackageSearch } from 'lucide-react'
import { NavLink } from 'react-router'
import { brand } from '@/lib/catalog'
import { cn } from '@/lib/utils'

const item = 'flex h-full flex-col items-center justify-center gap-1 rounded-[32px] text-[11px] leading-[14px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/** Floating navigation for phones and tablets, on the home and tracking pages only. */
export function BottomNav() {
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] z-30 mx-auto grid h-16 max-w-md grid-cols-3 items-center rounded-[32px] bg-nav shadow-nav lg:hidden"
    >
      <NavLink to="/" end className={({ isActive }) => cn(item, isActive ? 'text-brand-text' : 'text-muted-foreground')}>
        <House className="size-6" aria-hidden="true" />
        الرئيسية
      </NavLink>
      <NavLink to="/track" className={({ isActive }) => cn(item, 'justify-end pb-2', isActive ? 'text-brand-text' : 'text-foreground')}>
        <span className="-mt-5 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-cta">
          <PackageSearch className="size-6" aria-hidden="true" />
        </span>
        تتبع طلب
      </NavLink>
      <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(item, 'text-muted-foreground')}>
        <MessageCircle className="size-6" aria-hidden="true" />
        واتساب
      </a>
    </nav>
  )
}
