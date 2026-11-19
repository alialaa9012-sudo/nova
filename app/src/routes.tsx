import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import App from './App'
import { RouteLoading } from './components/RouteLoading'
import { BranchLayout } from './pages/BranchLayout'
import { CheckoutPage } from './pages/CheckoutPage'
import { HomePage } from './pages/HomePage'
import { MenuPage } from './pages/MenuPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OrderPage } from './pages/OrderPage'
import { TrackPage } from './pages/TrackPage'

/** A staff screen behind the sign-in gate (open on the local demo, which has no sign-in). */
async function staff(page: Promise<ComponentType>) {
  const [Page, { StaffGate }] = await Promise.all([page, import('./pages/admin/StaffGate')])
  return {
    Component: () => (
      <StaffGate>
        <Page />
      </StaffGate>
    ),
  }
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    errorElement: <NotFoundPage />,
    HydrateFallback: RouteLoading,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'branch/:branchId',
        element: <BranchLayout />,
        children: [
          { index: true, element: <MenuPage /> },
          { path: 'checkout', element: <CheckoutPage /> },
        ],
      },
      { path: 'order/:number', element: <OrderPage /> },
      { path: 'track', element: <TrackPage /> },
      // Staff screens load on demand, so customers never download them.
      { path: 'admin', lazy: () => staff(import('./pages/admin/AdminPage').then((m) => m.AdminPage)) },
      { path: 'admin/zones', lazy: () => staff(import('./pages/admin/ZonesPage').then((m) => m.ZonesPage)) },
      { path: 'admin/visits', lazy: () => staff(import('./pages/admin/VisitsPage').then((m) => m.VisitsPage)) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
