import { expect, test } from '@playwright/test'

// Monday 12:00 Cairo: all branches are open. Date is frozen, timers keep running.
const MONDAY_NOON_CAIRO = new Date('2027-01-04T10:00:00Z')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(MONDAY_NOON_CAIRO)
})

test.describe('home page', () => {
  test('shows the three branches in Arabic RTL with their opening state', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('خليها مشاوي | اطلب أونلاين')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('اطلب من خليها مشاوي')
    for (const name of ['فرع العاشر من رمضان', 'فرع الزقازيق', 'فرع التجمع الخامس']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
    }
    await expect(page.getByText('مفتوح الآن حتى 12 منتصف الليل')).toHaveCount(3)
    await expect(page.getByRole('note').first()).toContainText('نسخة تجريبية')
  })

  test('shows when a closed branch opens', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2027-01-04T07:00:00Z')) // 09:00 Cairo
    await page.goto('/')
    await expect(page.getByText('مغلق الآن، يفتح 11 صباحاً')).toHaveCount(3)
  })

  test('opens the chosen branch menu and deep links survive a reload', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'اطلب من فرع الزقازيق' }).click()
    await expect(page).toHaveURL(/\/branch\/zagazig$/)
    await expect(page.getByRole('heading', { level: 1, name: 'منيو فرع الزقازيق' })).toBeAttached()
    await expect(page.getByRole('heading', { level: 2, name: 'المشويات' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 2, name: 'المشويات' })).toBeVisible()
  })

  test('shows a not-found page for an unknown address', async ({ page }) => {
    await page.goto('/branch/cairo')
    await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible()
  })
})
