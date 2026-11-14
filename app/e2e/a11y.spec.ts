import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { MONDAY_NOON_CAIRO, pickZone } from './helpers.ts'

// Accessibility scans with axe-core (Deque). Each screen and open dialog must have
// no WCAG 2.x A/AA violation.

// Runs in the page (a string because the e2e TypeScript project has no DOM types).
const WAIT_FOR_ANIMATIONS = `Promise.all(
  document.getAnimations()
    .filter((a) => Number.isFinite(Number(a.effect && a.effect.getComputedTiming().endTime)))
    .map((a) => a.finished.catch(() => undefined))
)`

async function expectNoViolations(page: Page, testInfo: TestInfo, label: string) {
  // Sheets and dialogs fade in. Colors measured mid-fade are blends with the page behind,
  // not what people read, so let running (finite) animations finish before scanning.
  await page.evaluate(WAIT_FOR_ANIMATIONS)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  await testInfo.attach(`axe-${label}`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' })
  // One line per failing element, with the measured colors for contrast failures.
  const summary = results.violations.flatMap((v) =>
    v.nodes.map((n) => {
      const data = n.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined
      const colors = data?.contrastRatio ? ` (${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1)` : ''
      return `${v.id}: ${n.target.join(' ')}${colors}`
    }),
  )
  expect(summary, `axe violations on ${label}`).toEqual([])
}

test.describe('accessibility @a11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(MONDAY_NOON_CAIRO)
  })

  test('home, track and not-found pages', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoViolations(page, testInfo, 'home')

    await page.goto('/track')
    await page.getByRole('button', { name: 'عرض حالة الطلب' }).click()
    await expect(page.getByText('اكتب رقم الطلب كما وصلك، مثل A-0012.')).toBeVisible()
    await expectNoViolations(page, testInfo, 'track-with-errors')

    await page.goto('/nowhere')
    await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible()
    await expectNoViolations(page, testInfo, 'not-found')
  })

  test('menu, item sheet, cart, checkout and order pages', async ({ page }, testInfo) => {
    await page.goto('/branch/tagamoa')
    await expect(page.getByRole('heading', { level: 2, name: 'المشويات' })).toBeVisible()
    await expectNoViolations(page, testInfo, 'menu')

    await page.getByRole('button', { name: 'أضف صدور فراخ' }).click()
    const sheet = page.getByRole('dialog', { name: 'صدور فراخ' })
    await expect(sheet).toBeVisible()
    await expectNoViolations(page, testInfo, 'item-sheet')
    await sheet.getByRole('button', { name: /^أضف للسلة/ }).click()
    await expect(sheet).toBeHidden()

    await page.getByRole('button', { name: /عرض السلة/ }).click()
    const cart = page.getByRole('dialog', { name: 'السلة' })
    await expect(cart).toBeVisible()
    await expectNoViolations(page, testInfo, 'cart')
    await cart.getByRole('link', { name: 'إتمام الطلب' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeVisible()
    await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    await expect(page.getByText('اكتب الاسم.')).toBeVisible()
    await expectNoViolations(page, testInfo, 'checkout-with-errors')

    await page.getByLabel('الاسم').fill('سارة')
    await page.getByLabel('رقم الموبايل').fill('01098765432')
    // the open zone list is scanned too, then a zone is chosen from it
    await page.getByRole('combobox', { name: 'المنطقة' }).fill('اللوتس')
    await expect(page.getByRole('listbox', { name: 'المناطق' })).toBeVisible()
    await expectNoViolations(page, testInfo, 'checkout-zone-list')
    await pickZone(page, 'اللوتس الشمالية')
    await page.getByLabel('الشارع').fill('شارع التسعين')
    await page.getByLabel('رقم العمارة').fill('12')
    await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()
    await expectNoViolations(page, testInfo, 'order')
  })

  test('call-center board, order details and cancel dialog', async ({ page }, testInfo) => {
    await page.goto('/admin')
    await expect(page.getByText('لا توجد طلبات بهذه التصفية.')).toBeVisible()
    await expectNoViolations(page, testInfo, 'admin-empty')

    // Place one order so the board has a card to inspect.
    await page.goto('/branch/zagazig')
    await page.getByRole('button', { name: 'أضف صدور فراخ' }).click()
    await page.getByRole('dialog', { name: 'صدور فراخ' }).getByRole('button', { name: /^أضف للسلة/ }).click()
    await page.getByRole('button', { name: /عرض السلة/ }).click()
    await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
    await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
    await page.getByLabel('الاسم').fill('كريم')
    await page.getByLabel('رقم الموبايل').fill('01012345678')
    await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()

    await page.goto('/admin')
    const list = page.getByRole('list', { name: 'قائمة الطلبات' })
    await expect(list.getByRole('heading', { name: 'Z-0001' })).toBeVisible()
    await expectNoViolations(page, testInfo, 'admin-list')

    await list.getByRole('button', { name: 'التفاصيل' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoViolations(page, testInfo, 'admin-details')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()

    await list.getByRole('button', { name: 'إلغاء' }).click()
    await expect(page.getByRole('dialog', { name: 'إلغاء الطلب Z-0001' })).toBeVisible()
    await expectNoViolations(page, testInfo, 'cancel-dialog')
  })
  test('delivery zones screen with errors, an added zone and the delete confirmation', async ({ page }, testInfo) => {
    await page.goto('/admin/zones')
    await expect(page.getByRole('heading', { name: 'مناطق تحتاج سعراً (8)' })).toBeVisible()
    await page.getByRole('button', { name: 'إضافة المنطقة' }).click()
    await expect(page.getByText('اكتب اسم المنطقة.')).toBeVisible()
    await expectNoViolations(page, testInfo, 'zones-ashry-with-errors')

    await page.getByRole('button', { name: 'فرع التجمع الخامس' }).click()
    await page.getByLabel('اسم المنطقة', { exact: true }).fill('مدينتي')
    await page.getByLabel('رسوم التوصيل (ج.م)').fill('150')
    await page.getByRole('button', { name: 'إضافة المنطقة' }).click()
    await page.getByRole('button', { name: 'حذف مدينتي' }).click()
    await expect(page.getByRole('button', { name: 'تأكيد الحذف' })).toBeVisible()
    await expectNoViolations(page, testInfo, 'zones-added-confirm-delete')
  })
})
