import { createClient } from '@supabase/supabase-js'
import { browserStore, createLocalApi } from './local'
import { createSupabaseApi } from './supabase'
import type { OrdersApi } from './types'

// With a Supabase project configured (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build time) the
// app talks to it. Without one it runs on the local demo backend. The anon key is public by design:
// what each visitor may read or do is limited by the database's row level security.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const api: OrdersApi =
  url && anonKey ? createSupabaseApi(createClient(url, anonKey)) : createLocalApi({ store: browserStore() })

export { errorMessage } from './errors'
export { ApiError } from './types'
export type { AuthApi, NewZoneInput, Order, OrdersApi, PlaceOrderInput } from './types'
