import { MapPin, MessageCircle, Phone, Search } from 'lucide-react'
import { Link } from 'react-router'
import { BottomNav } from '@/components/BottomNav'
import { HeroBanner } from '@/components/HeroBanner'
import { OpenBadge } from '@/components/OpenBadge'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/useNow'
import { brand, branches, heroBanners, type Branch } from '@/lib/catalog'
import { summarizeHours } from '@/lib/hours'
import { lastOrder } from '@/lib/lastOrder'

const iconLink = 'grid size-12 shrink-0 place-items-center rounded-full bg-control shadow-card outline-none hover:bg-brand-tint focus-visible:ring-3 focus-visible:ring-ring/50'

function BranchCard({ branch, now }: { branch: Branch; now: Date }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-[20px] bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg leading-[26px] font-bold">فرع {branch.name}</h2>
        <OpenBadge branch={branch} now={now} />
      </div>
      <p className="text-[13px] leading-5 text-muted-foreground">{branch.address}</p>
      <ul className="grid gap-0.5 text-[13px] leading-5">
        {summarizeHours(branch.hours).map((h) => (
          <li key={h.days}>
            <span className="font-bold">{h.days}:</span> {h.text}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button asChild className="h-auto min-h-12 min-w-0 flex-1 px-4 py-2 text-center whitespace-normal">
          <Link to={`/branch/${branch.id}`}>اطلب من فرع {branch.name}</Link>
        </Button>
        <a href={`tel:${branch.phones[0]}`} aria-label="اتصال" className={iconLink}>
          <Phone className="size-5" aria-hidden="true" />
        </a>
        <a href={branch.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="الموقع" className={iconLink}>
          <MapPin className="size-5" aria-hidden="true" />
        </a>
      </div>
    </article>
  )
}

export function HomePage() {
  const now = useNow()
  const previous = lastOrder()
  return (
    <>
      <title>خليها مشاوي | اطلب أونلاين</title>
      <SiteHeader logo>
        {/* From 1024px the bottom navigation is hidden and its links live here. */}
        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="outline">
            <Link to="/track">
              <Search aria-hidden="true" /> تتبع طلب
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" /> واتساب
            </a>
          </Button>
        </div>
      </SiteHeader>
      <main className="mx-auto max-w-[1200px] px-5 pt-2 pb-6 md:px-6">
        <h1 className="text-[26px] leading-9 font-extrabold">اطلب من خليها مشاوي</h1>
        <p className="mt-1 text-sm leading-[22px] text-muted-foreground">اختر الفرع الأقرب لك لتظهر قائمة طعامه وأسعاره ومناطق توصيله.</p>
        <HeroBanner banners={heroBanners} onBrowse={() => document.getElementById('branches')?.scrollIntoView({ behavior: 'smooth' })} />
        <ul id="branches" className="mt-6 grid scroll-mt-24 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <li key={b.id}>
              <BranchCard branch={b} now={now} />
            </li>
          ))}
        </ul>
        <section aria-labelledby="help-title" className="mt-6 grid gap-3 rounded-[20px] bg-card p-4 shadow-card">
          <h2 id="help-title" className="text-base leading-6 font-bold">
            طلبت قبل كده؟
          </h2>
          <div className="flex flex-wrap gap-2">
            {previous ? (
              <Button asChild className="h-12">
                <Link to={`/order/${previous.number}`} state={{ phone: previous.phone }}>
                  حالة طلبك {previous.number}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="h-12 bg-control">
              <Link to="/track">
                <Search aria-hidden="true" /> تتبع طلب
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 bg-control">
              <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" /> واتساب <span dir="ltr">{brand.whatsappNumber}</span>
              </a>
            </Button>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-[1200px] px-5 pb-28 text-center text-xs leading-[18px] text-muted-foreground lg:pb-8">الدفع كاش عند الاستلام.</footer>
      <BottomNav />
    </>
  )
}
