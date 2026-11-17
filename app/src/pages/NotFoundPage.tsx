import { ArrowLeft, Store } from 'lucide-react'
import { Link } from 'react-router'
import { brand, branches } from '@/lib/catalog'

/** A wrong or old link: the logo, a short explanation, and a direct way into each branch. */
export function NotFoundPage() {
  return (
    <>
      <title>الصفحة غير موجودة | خليها مشاوي</title>
      <main id="content" tabIndex={-1} className="outline-none mx-auto grid max-w-xl px-4 pt-5 pb-12 md:px-6">
        <div className="text-center">
          <Link to="/" className="inline-block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <img src={brand.logoUrl} alt="خليها مشاوي" width={brand.logoWidth} height={brand.logoHeight} className="mx-auto h-[110px] w-auto" />
          </Link>
          <h1 className="mt-2 text-[25px] leading-9 font-extrabold">الصفحة غير موجودة</h1>
          <p className="text-sm leading-[22px] text-muted-foreground">ربما تغيّر الرابط. ابدأ من اختيار الفرع.</p>
        </div>
        <nav aria-label="اختيار الفرع" className="mt-5">
          <ul className="grid gap-2">
            {branches.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/branch/${b.id}`}
                  className="flex items-center gap-3 rounded-[18px] border border-border bg-card p-3 pe-3.5 outline-none hover:bg-control focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-control text-[#3a271a]" aria-hidden="true">
                    <Store className="size-5" />
                  </span>
                  <span className="flex-1 text-[15.5px] font-extrabold">فرع {b.name}</span>
                  <span className="grid size-10 place-items-center rounded-xl bg-linear-to-br from-[#3a271a] to-brand text-gold-hi" aria-hidden="true">
                    <ArrowLeft className="size-[18px]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </>
  )
}
