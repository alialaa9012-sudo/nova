import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/admin', label: 'الطلبات', end: true },
  { to: '/admin/zones', label: 'مناطق التوصيل', end: false },
]

/** Switches between the screens of the call-center board. */
export function AdminNav() {
  return (
    <nav aria-label="أقسام اللوحة">
      <ul className="flex gap-1 border-b border-brand-soft">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px block border-b-[3px] px-4 py-2.5 font-bold',
                  isActive ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
