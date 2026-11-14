import type { MenuStrip } from '@/lib/catalog'

/** An offer strip on the menu page. Display only; renders nothing without a real offer. */
export function PromoStrip({ strip }: { strip: MenuStrip | null }) {
  if (!strip) return null
  return (
    <p role="note" className="mt-4 flex min-h-16 items-center justify-between gap-3 rounded-[20px] bg-brand-tint p-4 font-bold">
      {strip.text}
      {strip.circle ? (
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-discount text-sm font-extrabold text-white" dir="ltr">
          {strip.circle}
        </span>
      ) : null}
    </p>
  )
}
