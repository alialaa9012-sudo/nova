import { useEffect, useRef } from 'react'

/**
 * While a window is open, the phone's Back button closes it instead of leaving the page.
 * Opening adds one history entry at the same address; Back removes it and closes the window.
 * Closing from the window itself removes that entry again, so Back never "does nothing" later.
 */
export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const mark = `${Date.now()}-${Math.random()}`
    window.history.pushState({ ...window.history.state, kmSheet: mark }, '')
    let closedByBack = false
    const onPop = () => {
      closedByBack = true
      closeRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Closed from the window (×, Escape, add): drop our entry, unless a link inside it already moved on.
      if (!closedByBack && window.history.state?.kmSheet === mark) window.history.back()
    }
  }, [open])
}
