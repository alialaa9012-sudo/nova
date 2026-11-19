import { ChevronLeft, MapPin, MessageCircle, PackageSearch, Phone, ShoppingBag } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { BottomNav } from '@/components/BottomNav'
import { HeroBanner } from '@/components/HeroBanner'
import { OpenBadge } from '@/components/OpenBadge'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/useNow'
import { brand, branches, heroBanners, type Branch } from '@/lib/catalog'
import { lastOrder } from '@/lib/lastOrder'
import { orderLabel } from '@/lib/orderNumber'
import { recordStep } from '@/lib/visits'

const iconLink =
  'grid size-[clamp(44px,6.4vh,52px)] shrink-0 place-items-center rounded-2xl bg-control text-foreground ring-1 ring-border outline-none hover:bg-gold-soft focus-visible:ring-3 focus-visible:ring-ring/50 lg:size-14 [&_svg]:size-[18px] lg:[&_svg]:size-6'

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
    <article className="flex h-full flex-col rounded-[20px] border border-border bg-card px-3.5 py-[clamp(8px,1.2vh,12px)] shadow-card lg:rounded-[28px] lg:p-6">
      <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-start">
        <h2 className="min-w-0 text-[17px] leading-[24px] font-bold text-balance lg:text-2xl">فرع {branch.name}</h2>
        <OpenBadge branch={branch} now={now} className="lg:px-3.5 lg:py-1.5 lg:text-[13px]" />
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground lg:mt-2 lg:text-[15px]" title={branch.address}>{shortAddress(branch)}</p>
      <div className="mt-auto flex items-center gap-2 pt-[clamp(6px,1.1vh,11px)] lg:gap-2.5 lg:pt-5">
        <Button asChild className="h-[clamp(44px,6.4vh,52px)] min-w-0 flex-1 text-[15px] lg:h-14 lg:text-[19px] lg:[&_svg]:size-5">
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
    <p className="mx-auto mt-1 flex items-center justify-center gap-2 lg:mt-3 lg:gap-3">
      <span className={`${line} bg-linear-to-r`} aria-hidden="true" />
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
  useEffect(() => recordStep('home'), [])
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
        <main id="content" tabIndex={-1} className="relative outline-none mx-auto flex w-full max-w-[1240px] min-[1700px]:max-w-[1480px] flex-1 flex-col px-5 pt-[clamp(10px,2vh,20px)] pb-28 short-phone:pt-2 md:px-6 lg:justify-center lg:px-8 lg:pb-16">
          <div className="relative text-center">
            <img
              src={brand.logoUrl}
              alt=""
              width={brand.logoWidth}
              height={brand.logoHeight}
              className="mx-auto h-[clamp(112px,16vh,140px)] w-auto lg:h-[clamp(150px,22vh,210px)]"
            />
            {/* The logo already shows the name, so the page title is for screen readers and search only. */}
            <h1 className="sr-only">{brand.name}</h1>
            <Slogan />
            <p className="mx-auto mt-[clamp(2px,0.6vh,6px)] max-w-[30ch] text-[13px] leading-[22px] text-muted-foreground short-phone:hidden lg:mt-3 lg:max-w-none lg:text-lg">
              اختر الفرع الأقرب لك لتظهر قائمة طعامه وأسعاره ومناطق توصيله.
            </p>
          </div>
          {previous ? (
            // A small pill under the slogan, so it costs one short line and the branches stay in view.
            <Link
              to={`/order/${previous.number}`}
              state={{ phone: previous.phone }}
              className="relative mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full border border-gold/60 bg-card px-3 py-1 text-[12.5px] leading-[18px] shadow-sm outline-none after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:bg-control focus-visible:ring-3 focus-visible:ring-ring/50 lg:mt-4 lg:gap-2 lg:px-5 lg:py-2 lg:text-base"
            >
              <PackageSearch className="size-4 shrink-0 text-gold-deep lg:size-5" aria-hidden="true" />
              <span className="font-bold">طلبك {orderLabel(previous.number)}</span>
              <span className="text-gold-deep">· تابع حالته</span>
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ) : null}
          <HeroBanner
            banners={heroBanners}
            onBrowse={() => {
              const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
              document.getElementById('branches')?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' })
            }}
          />
          {/* On phones the list takes the height left above the bottom bar and shares it between the three
              cards (up to a limit), so a tall screen gets taller cards instead of an empty band. */}
          <ul
            id="branches"
            className="mx-auto mt-[clamp(10px,1.8vh,16px)] grid w-full scroll-mt-24 gap-[clamp(8px,1.5vh,14px)] short-phone:mt-3 short-phone:gap-2 max-lg:max-h-[34rem] max-lg:flex-1 max-lg:auto-rows-fr md:max-w-[640px] lg:mt-11 lg:max-w-none lg:grid-cols-3 lg:gap-[22px]"
          >
            {branches.map((b) => (
              <li key={b.id} className="min-w-0">
                <BranchCard branch={b} now={now} />
              </li>
            ))}
          </ul>
        </main>
      </div>
      <BottomNav />
    </>
  )
}
