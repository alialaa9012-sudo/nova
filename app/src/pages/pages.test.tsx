import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { api } from '@/lib/api'
import { getMenu } from '@/lib/catalog'
import { routes } from '@/routes'

const MONDAY_NOON_CAIRO = new Date('2027-01-04T10:00:00Z')

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MONDAY_NOON_CAIRO)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('home page', () => {
  it('lists the three branches as open with their hours and marks the demo mode', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'اطلب من خليها مشاوي' })).toBeInTheDocument()
    for (const name of ['فرع العاشر من رمضان', 'فرع الزقازيق', 'فرع التجمع الخامس']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getAllByText('مفتوح الآن حتى 12 منتصف الليل')).toHaveLength(3)
    expect(screen.getAllByText('الخميس والجمعة:')).toHaveLength(3)
    expect(screen.getByRole('note')).toHaveTextContent('نسخة تجريبية')
  })

  it('shows when a closed branch opens', () => {
    vi.setSystemTime(new Date('2027-01-04T07:00:00Z')) // 09:00 Cairo
    renderAt('/')
    expect(screen.getAllByText('مغلق الآن، يفتح 11 صباحاً')).toHaveLength(3)
  })
})

describe('ordering', () => {
  it('goes from the menu to a placed pickup order with its number and status', async () => {
    const user = userEvent.setup()
    renderAt('/branch/ashry')
    expect(screen.getByRole('heading', { level: 2, name: 'المشويات' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'أضف صدور فراخ' }))
    const sheet = await screen.findByRole('dialog', { name: 'صدور فراخ' })
    await user.click(within(sheet).getByRole('radio', { name: /^نص/ }))
    await user.click(within(sheet).getByRole('button', { name: 'زيادة الكمية' }))
    await user.click(within(sheet).getByRole('button', { name: 'أضف للسلة · 680 ج.م' }))

    await user.click(await screen.findByRole('button', { name: /عرض السلة \(2\) · 680 ج.م/ }))
    const cart = await screen.findByRole('dialog', { name: 'السلة' })
    expect(within(cart).getByText('صدور فراخ (نص)')).toBeInTheDocument()
    await user.click(within(cart).getByRole('link', { name: 'إتمام الطلب' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'استلام من الفرع' }))
    await user.type(screen.getByLabelText('الاسم'), 'منى')
    await user.type(screen.getByLabelText('رقم الموبايل'), '01112345678')
    await user.click(screen.getByRole('button', { name: 'تأكيد الطلب · 680 ج.م' }))

    expect(await screen.findByRole('heading', { name: 'تم إرسال طلبك' })).toBeInTheDocument()
    expect(screen.getAllByText('A-0001').length).toBeGreaterThan(0)
    const timeline = screen.getByRole('list', { name: 'حالة الطلب' })
    expect(within(timeline).getByText('طلب جديد').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(within(timeline).getByText('جاهز للاستلام')).toBeInTheDocument()
    expect(localStorage.getItem('km.cart.v1.ashry')).toBe('[]')
  })

  it('validates delivery details and shows the zone fee and Tagamoa tax before ordering', async () => {
    const user = userEvent.setup()
    const item = getMenu('tagamoa')[0].items.find((i) => i.name === 'صدور فراخ')!
    localStorage.setItem(
      'km.cart.v1.tagamoa',
      JSON.stringify([{ sizeId: item.sizes[0].id, itemId: item.id, name: item.name, sizeLabel: 'ربع', unitPrice: 1, qty: 2 }]),
    )
    renderAt('/branch/tagamoa/checkout')
    // the saved price (1) is replaced by the catalog price (250)
    await user.click(screen.getByRole('button', { name: 'تأكيد الطلب · 570 ج.م' }))
    expect(screen.getByText('اكتب الاسم.')).toBeInTheDocument()
    expect(screen.getByText('اختر المنطقة.')).toBeInTheDocument()
    expect(screen.getByLabelText('الاسم')).toHaveFocus()
    expect(screen.getByLabelText('الاسم')).toHaveAttribute('aria-invalid', 'true')

    await user.selectOptions(screen.getByLabelText('المنطقة'), screen.getByRole('option', { name: 'اللوتس الشمالية · 75 ج.م' }))
    expect(screen.getByText('ضريبة 14٪')).toBeInTheDocument()
    expect(screen.getByText('70 ج.م')).toBeInTheDocument() // 14% of 500
    expect(screen.getByRole('button', { name: 'تأكيد الطلب · 645 ج.م' })).toBeEnabled()
  })

  it('shows booking-only items with a call button instead of add', () => {
    renderAt('/branch/tagamoa')
    expect(screen.getByRole('link', { name: 'احجز كتف' })).toHaveAttribute('href', 'tel:01008888329')
    expect(screen.queryByRole('button', { name: 'أضف كتف' })).not.toBeInTheDocument()
  })

  it('shows a not-found page for an unknown branch', () => {
    renderAt('/branch/cairo')
    expect(screen.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeInTheDocument()
  })
})

describe('call-center board', () => {
  it('lists new orders, moves them forward and cancels with a reason', async () => {
    const user = userEvent.setup()
    const item = getMenu('zagazig')[0].items[0]
    await api.placeOrder({
      branchId: 'zagazig',
      orderType: 'pickup',
      customerName: 'كريم',
      phone: '01012345678',
      lines: [{ sizeId: item.sizes[0].id, qty: 1 }],
    })
    renderAt('/admin')

    const list = await screen.findByRole('list', { name: 'قائمة الطلبات' })
    expect(within(list).getByRole('heading', { name: 'Z-0001' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'جديد (1)' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(list).getByRole('button', { name: 'نقل إلى: تم استلام طلبك وجاري التجهيز' }))
    expect(await screen.findByRole('button', { name: 'جاري التجهيز (1)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'جاري التجهيز (1)' }))
    await user.click(screen.getByRole('button', { name: 'إلغاء' }))

    const dialog = await screen.findByRole('dialog', { name: 'إلغاء الطلب Z-0001' })
    const confirm = within(dialog).getByRole('button', { name: 'تأكيد الإلغاء' })
    expect(confirm).toBeDisabled()
    await user.click(within(dialog).getByRole('radio', { name: 'العميل لا يرد' }))
    await user.click(confirm)

    expect(await screen.findByRole('button', { name: 'ملغي (1)' })).toBeInTheDocument()
    const [order] = await api.listOrders()
    expect(order.status).toBe('cancelled')
    expect(order.cancelReason).toBe('العميل لا يرد')
    expect(order.history.map((h) => h.to)).toEqual(['new', 'preparing', 'cancelled'])
  })
})
