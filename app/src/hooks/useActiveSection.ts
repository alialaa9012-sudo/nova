import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The id of the section currently under the sticky bars while the page scrolls, and a way to
 * select one directly. `offset` is the height covered by those bars.
 *
 * Scrolling is watched on the whole document in the capture phase, so it also works where the
 * page scrolls inside a container instead of the window (the Artifact viewer scrolls the body).
 */
export function useActiveSection(ids: string[], offset: number): [string | null, (id: string) => void] {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  // While a tapped section is being scrolled to, keep it selected instead of following the scroll.
  const pinned = useRef<{ id: string; until: number } | null>(null)
  const settle = useRef(0)
  const remeasure = useRef<() => void>(() => {})

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      if (pinned.current) return
      let current = ids[0] ?? null
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top - offset <= 1) current = id
      }
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    // Releasing the pin measures again, so a scroll that happened meanwhile is not missed.
    const release = () => {
      pinned.current = null
      schedule()
    }
    remeasure.current = release
    const onScroll = () => {
      if (pinned.current) {
        // Keep the tapped section until the scroll has been quiet for a moment (the smooth scroll ended).
        window.clearTimeout(settle.current)
        settle.current = window.setTimeout(release, 160)
        if (Date.now() < pinned.current.until) return
        pinned.current = null
      }
      schedule()
    }
    measure()
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(settle.current)
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
    }
  }, [ids, offset])

  const select = useCallback((id: string) => {
    pinned.current = { id, until: Date.now() + 1500 }
    setActive(id)
    // If nothing scrolls (already in place), release the pin shortly after.
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => remeasure.current(), 600)
  }, [])

  return [active, select]
}
