import { browserStore, createLocalApi } from './local'
import { ApiError, type AuthApi, type OrdersApi } from './types'

// With a Supabase project configured (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build time) the
// app talks to it. Without one it runs on the local demo backend. The anon key is public by design:
// what each visitor may read or do is limited by the database's row level security.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const remote = Boolean(url && anonKey)

// The Supabase library is large (about 460 KB) and the first screens (home, menu) need none of it,
// so it is fetched apart: on the first call, or once the page is idle, whichever comes first. The
// live speed test showed it was half of what a phone downloaded before showing anything.
let backend: Promise<OrdersApi> | undefined
function load(): Promise<OrdersApi> {
  backend ??= remote
    ? Promise.all([import('@supabase/supabase-js'), import('./supabase')]).then(([{ createClient }, { createSupabaseApi }]) =>
        createSupabaseApi(createClient(url!, anonKey!)),
      )
    : Promise.resolve(createLocalApi({ store: browserStore() }))
  backend.catch(() => (backend = undefined)) // a failed download is retried on the next call
  return backend
}
if (remote && typeof window !== 'undefined') {
  const warm = () => void load().catch(() => undefined)
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 4000 })
  else setTimeout(warm, 1500)
}

/** Offline, fail at once with the usual message instead of waiting for the library's retries. */
function online(): void {
  if (remote && typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('NETWORK')
}

/** An API method that waits for the library, then does the same as the real one. */
function call<K extends keyof OrdersApi>(name: K): OrdersApi[K] {
  const fn = async (...args: unknown[]) => {
    online()
    const impl = await load()
    return (impl[name] as unknown as (...a: unknown[]) => Promise<unknown>)(...args)
  }
  return fn as unknown as OrdersApi[K]
}

/** Something that starts once the library has arrived and can be stopped before or after that. */
function later(start: (impl: OrdersApi) => () => void): () => void {
  let stop: (() => void) | undefined
  let stopped = false
  void load().then((impl) => {
    if (!stopped) stop = start(impl)
  }, () => undefined)
  return () => {
    stopped = true
    stop?.()
  }
}

const auth: AuthApi | undefined = remote
  ? {
      getSession: async () => (await load()).auth!.getSession(),
      signIn: async (email, password) => {
        online()
        return (await load()).auth!.signIn(email, password)
      },
      signOut: async () => (await load()).auth!.signOut(),
      onChange: (callback) => later((impl) => impl.auth!.onChange(callback)),
    }
  : undefined

export const api: OrdersApi = {
  mode: remote ? 'supabase' : 'local',
  auth,
  placeOrder: call('placeOrder'),
  trackOrder: call('trackOrder'),
  listOrders: call('listOrders'),
  getOrder: call('getOrder'),
  setStatus: call('setStatus'),
  setPosInvoice: call('setPosInvoice'),
  logVisit: call('logVisit'),
  visitFunnel: call('visitFunnel'),
  advanceDueOrders: call('advanceDueOrders'),
  listZones: call('listZones'),
  addZone: call('addZone'),
  removeZone: call('removeZone'),
  subscribe: (onChange, options) => later((impl) => impl.subscribe(onChange, options)),
}

export { errorMessage } from './errors'
export { ApiError } from './types'
export type { AuthApi, NewZoneInput, Order, OrdersApi, PlaceOrderInput } from './types'
