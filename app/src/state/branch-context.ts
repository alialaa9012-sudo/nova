import { useOutletContext } from 'react-router'
import type { Branch } from '@/lib/catalog'

/** The branch chosen in the URL, provided by BranchLayout. */
export const useBranch = (): Branch => useOutletContext<Branch>()
