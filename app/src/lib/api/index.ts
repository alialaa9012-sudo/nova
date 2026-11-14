import { browserStore, createLocalApi } from './local'
import type { OrdersApi } from './types'

// Until the Supabase project exists, the app runs on the local demo backend.
export const api: OrdersApi = createLocalApi({ store: browserStore() })

export { errorMessage } from './errors'
export { ApiError } from './types'
export type { NewZoneInput, Order, OrdersApi, PlaceOrderInput } from './types'
