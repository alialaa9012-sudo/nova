import { expect, test } from '@playwright/test'
import { MONDAY_NOON_CAIRO } from './helpers.ts'

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
    // customers never get a way into the staff board from the site itself
    await expect(page.getByRole('link', { name: 'لوحة الكول سنتر' })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'خليها مشاوي' })).toHaveJSProperty('complete', true)
  })

  test('phones get a bottom navigation, wide screens get the same links in the header', async ({ page, isMobile }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' })
    if (isMobile) {
      await expect(nav.getByRole('link', { name: 'الرئيسية' })).toHaveAttribute('aria-current', 'page')
      await nav.getByRole('link', { name: 'تتبع طلب' }).click()
      await expect(page).toHaveURL(/\/track$/)
      await expect(page.getByRole('navigation', { name: 'التنقل الرئيسي' }).getByRole('link', { name: 'تتبع طلب' })).toHaveAttribute('aria-current', 'page')
    } else {
      await expect(nav).toBeHidden()
      await page.getByRole('banner').getByRole('link', { name: 'تتبع طلب' }).click()
      await expect(page).toHaveURL(/\/track$/)
    }
  })

  test('the menu highlights the section in view and search narrows it', async ({ page }) => {
    await page.goto('/branch/ashry')
    const bar = page.getByRole('navigation', { name: 'أقسام المنيو' })
    await expect(bar.getByRole('link', { name: 'المشويات' })).toHaveAttribute('aria-current', 'true')
    await bar.getByRole('link', { name: 'المشروبات' }).click()
    await expect(bar.getByRole('link', { name: 'المشروبات' })).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('heading', { level: 2, name: 'المشروبات' })).toBeInViewport()

    await page.getByRole('searchbox', { name: 'ابحث عن صنف' }).fill('كفته')
    await expect(page.getByRole('button', { name: 'أضف كفتة فراخ' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'أضف صدور فراخ' })).toHaveCount(0)
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
