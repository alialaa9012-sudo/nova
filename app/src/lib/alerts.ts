/**
 * New-order alerts for the staff board: a chime through one shared AudioContext, and a system
 * notification that shows even when the board's tab is in the background.
 *
 * Browsers keep audio locked until the person has clicked or typed on the page. The board unlocks
 * it on the first click (see unlockSoundOnGesture) and offers a button while it is still locked.
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (ctx) return ctx
  const Ctx = typeof window === 'undefined' ? undefined : window.AudioContext
  if (!Ctx) return null
  try {
    ctx = new Ctx()
  } catch {
    return null
  }
  return ctx
}

/** True when a chime would be heard now (or most likely would, before the first one is made). */
export function soundReady(): boolean {
  if (ctx) return ctx.state === 'running'
  return typeof navigator !== 'undefined' && Boolean(navigator.userActivation?.hasBeenActive)
}

/** Call from a click or key press: lets the page play sound from then on, also in the background. */
export async function unlockSound(): Promise<boolean> {
  const c = audio()
  if (!c) return false
  try {
    // resume() can stay pending in a tab the browser keeps in the background; never wait on it long.
    await Promise.race([c.resume(), new Promise((resolve) => setTimeout(resolve, 1000))])
  } catch {
    /* still locked */
  }
  return c.state === 'running'
}

/** Unlocks audio on the next click or key press anywhere on the page. Returns a cleanup. */
export function unlockSoundOnGesture(onUnlocked?: () => void): () => void {
  const handler = () => {
    void unlockSound().then((ok) => {
      if (!ok) return
      stop()
      onUnlocked?.()
    })
  }
  const stop = () => {
    window.removeEventListener('pointerdown', handler, true)
    window.removeEventListener('keydown', handler, true)
  }
  window.addEventListener('pointerdown', handler, true)
  window.addEventListener('keydown', handler, true)
  return stop
}

/** A short two-note chime, loud enough to hear across a room. Silent when audio is locked. */
export function playBeep(): void {
  const c = audio()
  if (!c) return
  try {
    if (c.state !== 'running') void c.resume()
    const start = c.currentTime + 0.02
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      const t = start + i * 0.22
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
      osc.connect(gain).connect(c.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    }
  } catch {
    /* no audio device */
  }
}

export type NotifyPermission = NotificationPermission | 'unsupported'

export function notifyPermission(): NotifyPermission {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
}

/** Asks once for permission to show system notifications. Must run from a click. */
export async function askNotify(): Promise<NotifyPermission> {
  if (notifyPermission() !== 'default') return notifyPermission()
  try {
    return await Notification.requestPermission()
  } catch {
    return notifyPermission()
  }
}

/** A system notification that stays until clicked; clicking brings the board to the front. */
export function notify(title: string, body: string, tag: string): void {
  if (notifyPermission() !== 'granted') return
  try {
    const n = new Notification(title, { body, tag, requireInteraction: true, lang: 'ar', dir: 'rtl' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* phones only allow notifications from a service worker */
  }
}
