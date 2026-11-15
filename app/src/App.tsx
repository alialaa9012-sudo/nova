import { Outlet, ScrollRestoration } from 'react-router'
import { DemoBanner } from '@/components/DemoBanner'

export default function App() {
  return (
    <>
      <DemoBanner />
      <Outlet />
      {/* Fresh loads share the key "default"; key them by path so a new page never opens mid-scroll. */}
      <ScrollRestoration getKey={(l) => (l.key === 'default' ? l.pathname : l.key)} />
    </>
  )
}
