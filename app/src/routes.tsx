import type { RouteObject } from 'react-router'
import App from './App'
import { AdminPage } from './pages/admin/AdminPage'
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
      { path: 'admin', element: <AdminPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
