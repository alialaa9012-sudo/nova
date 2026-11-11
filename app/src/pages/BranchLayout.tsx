import { Outlet, useParams } from 'react-router'
import { getBranch } from '@/lib/catalog'
import { CartProvider } from '@/state/CartProvider'
import { NotFoundPage } from './NotFoundPage'

export function BranchLayout() {
  const { branchId } = useParams()
  const branch = branchId ? getBranch(branchId) : undefined
  if (!branch) return <NotFoundPage />
  return (
    <CartProvider key={branch.id} branchId={branch.id}>
      <Outlet context={branch} />
    </CartProvider>
  )
}
