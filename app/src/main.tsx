import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router'
import { DirectionProvider } from '@/components/ui/direction'
import { Toaster } from '@/components/ui/sonner'
import './index.css'
import { routes } from './routes'

// The artifact preview (npm run build:artifact) runs in a frame that has no page addresses,
// so it keeps the current screen in memory instead of in the URL.
const router = import.meta.env.MODE === 'artifact' ? createMemoryRouter(routes) : createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DirectionProvider dir="rtl">
      <RouterProvider router={router} />
      {/* Above the floating cart bar and the bottom navigation. */}
      <Toaster position="bottom-center" richColors offset={{ bottom: 96 }} mobileOffset={{ bottom: 96 }} />
    </DirectionProvider>
  </StrictMode>,
)
