import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DirectionProvider } from '@/components/ui/direction'
import { Toaster } from '@/components/ui/sonner'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DirectionProvider dir="rtl">
      <App />
      <Toaster position="top-center" />
    </DirectionProvider>
  </StrictMode>,
)
