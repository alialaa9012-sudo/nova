import { Outlet, ScrollRestoration } from 'react-router'
import { DemoBanner } from '@/components/DemoBanner'

export default function App() {
  return (
    <>
      {/* Keyboard users skip the banner, header and category chips. */}
      <a
        href="#content"
        className="sr-only z-[60] rounded-xl bg-brand px-4 py-3 font-bold text-band-ink focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        انتقل إلى المحتوى
      </a>
      <DemoBanner />
      <Outlet />
      {/* Fresh loads share the key "default"; key them by path so a new page never opens mid-scroll. */}
      <ScrollRestoration getKey={(l) => (l.key === 'default' ? l.pathname : l.key)} />
    </>
  )
}
