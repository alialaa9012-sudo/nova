// Vitest setup: jest-dom matchers + automatic cleanup between tests.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom lacks these browser APIs used by Radix UI and React Router's scroll restoration.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true })
}
