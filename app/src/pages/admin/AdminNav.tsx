import { NavLink } from 'react-router'
import { api } from '@/lib/api'
import { brand } from '@/lib/catalog'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/admin', label: 'الطلبات', end: true },
  { to: '/admin/zones', label: 'مناطق التوصيل', end: false },
]

/** The staff band: gold logo, the board's name and the switch between its screens. */
export function AdminNav() {
  return (
    <header className="bg-hero-to bg-[radial-gradient(70%_160%_at_50%_0%,var(--hero-from),var(--hero-to)_80%)] text-band-ink">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 md:px-6 lg:px-8">
        <img src={brand.logoGoldSmallUrl} alt="خليها مشاوي" width={brand.logoGoldWidth} height={brand.logoGoldHeight} className="h-12 w-auto shrink-0" />
        <p className="text-lg leading-7 font-extrabold lg:text-xl">لوحة الكول سنتر</p>
        <nav aria-label="أقسام اللوحة" className="ms-auto lg:ms-5">
          <ul className="flex gap-1 rounded-full bg-white/6 p-1 ring-1 ring-gold-hi/35">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center rounded-full px-4 text-sm font-extrabold outline-none focus-visible:ring-3 focus-visible:ring-gold-hi/70',
                      isActive ? 'bg-linear-to-l from-[#d8b57a] to-gold text-brand' : 'text-band-ink/85 hover:text-band-ink',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {api.auth ? (
          <button
            type="button"
            onClick={() => void api.auth?.signOut()}
            className="min-h-11 rounded-full px-4 text-sm font-extrabold text-band-ink/85 outline-none hover:text-band-ink focus-visible:ring-3 focus-visible:ring-gold-hi/70"
          >
            خروج
          </button>
        ) : null}
      </div>
    </header>
  )
}
