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
      { path: 'admin', lazy: () => import('./pages/admin/AdminPage').then((m) => ({ Component: m.AdminPage })) },
      { path: 'admin/zones', lazy: () => import('./pages/admin/ZonesPage').then((m) => ({ Component: m.ZonesPage })) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
