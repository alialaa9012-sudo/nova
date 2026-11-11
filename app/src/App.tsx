import { Outlet, ScrollRestoration } from 'react-router'
import { DemoBanner } from '@/components/DemoBanner'

export default function App() {
  return (
    <>
      <DemoBanner />
      <Outlet />
      <ScrollRestoration />
    </>
  )
}
