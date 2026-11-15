import { brand } from '@/lib/catalog'

/** Shown while an on-demand screen loads: the same logo-on-page-colour as the start-up shell. */
export function RouteLoading() {
  return (
    <div className="grid min-h-svh place-items-center" aria-busy="true">
      <img src={brand.logoUrl} alt="خليها مشاوي" width={150} height={133} />
    </div>
  )
}
