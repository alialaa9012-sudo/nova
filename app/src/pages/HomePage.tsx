import { ChevronLeft, MapPin, MessageCircle, PackageSearch, Phone, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router'
import { BottomNav } from '@/components/BottomNav'
import { HeroBanner } from '@/components/HeroBanner'
import { OpenBadge } from '@/components/OpenBadge'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/useNow'
import { brand, branches, heroBanners, type Branch } from '@/lib/catalog'
import { lastOrder } from '@/lib/lastOrder'

const iconLink =
  'grid size-11 shrink-0 place-items-center rounded-2xl bg-control text-foreground ring-1 ring-border outline-none hover:bg-gold-soft focus-visible:ring-3 focus-visible:ring-ring/50 lg:size-14 [&_svg]:size-[18px] lg:[&_svg]:size-6'

/** The address without the city, which the branch name already says. */
function shortAddress(branch: Branch) {
  return branch.address.startsWith(`${branch.name} - `) ? branch.address.slice(branch.name.length + 3) : branch.address
}

/**
 * One branch: name with its status badge on the same row (the badge always sits at the far end),
 * the address on one line, then «اطلب الآن» with call and map beside it.
 */
function BranchCard({ branch, now }: { branch: Branch; now: Date }) {
  return (
    <article className="flex h-full flex-col rounded-[20px] border border-border bg-card px-3.5 py-[clamp(10px,1.6vh,14px)] shadow-card lg:rounded-[28px] lg:p-6">
      <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-start">
        <h2 className="min-w-0 text-[17px] leading-[24px] font-bold text-balance lg:text-2xl">فرع {branch.name}</h2>
        <OpenBadge branch={branch} now={now} className="lg:px-3.5 lg:py-1.5 lg:text-[13px]" />
      </div>
      <p className="mt-[clamp(2px,0.7vh,6px)] line-clamp-2 text-xs leading-5 text-muted-foreground lg:mt-2 lg:text-[15px]" title={branch.address}>{shortAddress(branch)}</p>
      <div className="mt-auto flex items-center gap-2 pt-[clamp(8px,1.5vh,13px)] lg:gap-2.5 lg:pt-5">
        <Button asChild className="h-11 min-w-0 flex-1 text-[15px] lg:h-14 lg:text-[19px] lg:[&_svg]:size-5">
          <Link to={`/branch/${branch.id}`} aria-label={`اطلب من فرع ${branch.name}`}>
            <ShoppingBag aria-hidden="true" /> اطلب الآن
          </Link>
        </Button>
        <a href={`tel:${branch.phones[0]}`} aria-label="اتصال" className={iconLink}>
          <Phone aria-hidden="true" />
        </a>
        <a href={branch.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="الموقع" className={iconLink}>
          <MapPin aria-hidden="true" />
        </a>
      </div>
    </article>
  )
}

/** The slogan in the logo's calligraphic style, between gold hairlines and diamonds like the logo's frame. */
function Slogan() {
  const line = 'h-px w-7 from-gold to-transparent lg:w-16'
  const diamond = 'size-[6px] shrink-0 rotate-45 bg-gold lg:size-2'
  return (
    <p className="mx-auto mt-0.5 flex items-center justify-center gap-2 short-phone:justify-start lg:mt-2 lg:gap-3">
      <span className={`${line} bg-linear-to-r short-phone:hidden`} aria-hidden="true" />
      <span className={diamond} aria-hidden="true" />
      <span className="font-naskh text-[19px] leading-7 font-bold text-gold-deep lg:text-[30px] lg:leading-10">الشوي على أصوله</span>
      <span className={diamond} aria-hidden="true" />
      <span className={`${line} bg-linear-to-l`} aria-hidden="true" />
    </p>
  )
}

export function HomePage() {
  const now = useNow()
  const previous = lastOrder()
  return (
    <>
      <title>خليها مشاوي | اطلب أونلاين</title>
      <div className="flex min-h-[calc(100dvh-var(--banner-h,0px))] flex-col">
        {/* From 1024px the bottom navigation is hidden and its links live here. */}
        <header className="mx-auto hidden w-full max-w-[1240px] min-[1700px]:max-w-[1480px] items-center justify-end gap-2.5 px-8 pt-4 lg:flex">
          <Button asChild variant="outline" size="lg">
            <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" /> واتساب
            </a>
          </Button>
          <Button asChild size="lg">
            <Link to="/track">
              <PackageSearch aria-hidden="true" /> تتبع طلب
            </Link>
          </Button>
        </header>
        <main id="content" tabIndex={-1} className="outline-none mx-auto flex w-full max-w-[1240px] min-[1700px]:max-w-[1480px] flex-1 flex-col px-5 pt-[clamp(10px,2vh,20px)] pb-28 short-phone:pt-2 md:px-6 lg:justify-center lg:px-8 lg:pb-16">
          {/* On short phones the logo sits beside the name and slogan instead of above them, at the same size,
              so the three branch cards fit above the bottom bar without being changed. */}
          <div className="relative text-center">
            <div className="short-phone:flex short-phone:items-center short-phone:justify-center short-phone:gap-3">
              <img
                src={brand.logoUrl}
                alt=""
                width={brand.logoWidth}
                height={brand.logoHeight}
                className="mx-auto h-[clamp(90px,12.5vh,118px)] w-auto short-phone:mx-0 lg:h-[clamp(150px,22vh,210px)]"
              />
              <div className="short-phone:text-start">
                <h1 className="text-[26px] leading-9 font-extrabold lg:mt-1.5 lg:text-[clamp(44px,6.5vh,58px)] lg:leading-tight">{brand.name}</h1>
                <Slogan />
              </div>
            </div>
            <p className="mx-auto mt-[clamp(2px,0.6vh,6px)] max-w-[30ch] text-[13px] leading-[22px] text-muted-foreground short-phone:hidden lg:mt-3 lg:max-w-none lg:text-lg">
              اختر الفرع الأقرب لك لتظهر قائمة طعامه وأسعاره ومناطق توصيله.
            </p>
          </div>
          {previous ? (
            <Link
              to={`/order/${previous.number}`}
              state={{ phone: previous.phone }}
              className="mx-auto mt-4 flex min-h-12 w-full items-center gap-3 rounded-2xl short-phone:mt-3 short-phone:min-h-11 short-phone:py-2 border border-gold/60 bg-card px-4 py-2.5 shadow-card outline-none hover:bg-control focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-fit sm:min-w-80"
            >
              <PackageSearch className="size-5 shrink-0 text-gold-deep" aria-hidden="true" />
              <span className="flex-1 font-bold">حالة طلبك {previous.number}</span>
              <ChevronLeft className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ) : null}
          <HeroBanner
            banners={heroBanners}
            onBrowse={() => {
              const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
              document.getElementById('branches')?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' })
            }}
          />
          <ul
            id="branches"
            className="mx-auto mt-[clamp(10px,1.8vh,16px)] grid w-full scroll-mt-24 gap-[clamp(8px,1.5vh,14px)] short-phone:mt-3 short-phone:gap-2 md:max-w-[640px] lg:mt-11 lg:max-w-none lg:grid-cols-3 lg:gap-[22px]"
          >
            {branches.map((b) => (
              <li key={b.id} className="min-w-0">
                <BranchCard branch={b} now={now} />
              </li>
            ))}
          </ul>
          <p className="mt-8 hidden text-center text-xs leading-[18px] text-muted-foreground lg:block">الدفع كاش عند الاستلام.</p>
        </main>
      </div>
      <BottomNav />
    </>
  )
}
