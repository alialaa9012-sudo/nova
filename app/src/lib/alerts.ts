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

/** Schedules one two-note chime at `t` (seconds on the audio clock) into `out`. */
function chime(c: AudioContext, out: AudioNode, t: number): void {
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    const start = t + i * 0.22
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38)
    osc.connect(gain).connect(out)
    osc.start(start)
    osc.stop(start + 0.4)
  }
}

/** A short two-note chime, loud enough to hear across a room. Silent when audio is locked. */
export function playBeep(): void {
  const c = audio()
  if (!c) return
  try {
    if (c.state !== 'running') void c.resume()
    chime(c, c.destination, c.currentTime + 0.02)
  } catch {
    /* no audio device */
  }
}

/** Seconds between chimes while ringing, and how far ahead they are scheduled. */
const RING_EVERY = 4
const RING_AHEAD = 20 * 60

let ring: { outs: GainNode[]; until: number } | null = null

/**
 * Rings until stopRinging(). The chimes are scheduled on the audio clock rather than with timers:
 * browsers slow timers in background tabs down to once a minute, but not audio already scheduled.
 * Call it again from time to time: it only tops the schedule up when it is running low.
 */
export function startRinging(): void {
  const c = audio()
  if (!c) return
  try {
    if (c.state !== 'running') void c.resume()
    if (ring && ring.until - c.currentTime > 5 * 60) return
    const out = c.createGain()
    out.connect(c.destination)
    const begin = Math.max(c.currentTime + 0.02, ring?.until ?? 0)
    for (let t = begin; t < begin + RING_AHEAD; t += RING_EVERY) chime(c, out, t)
    ring = { outs: [...(ring?.outs ?? []), out], until: begin + RING_AHEAD }
  } catch {
    /* no audio device */
  }
}

export function stopRinging(): void {
  if (!ring) return
  for (const out of ring.outs) out.disconnect()
  ring = null
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
