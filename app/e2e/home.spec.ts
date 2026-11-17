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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('خليها مشاوي')
    await expect(page.getByText('الشوي على أصوله')).toBeVisible()
    for (const name of ['فرع العاشر من رمضان', 'فرع الزقازيق', 'فرع التجمع الخامس']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
    }
    await expect(page.getByText('مفتوح حتى 12 ليلاً')).toHaveCount(3)
    await expect(page.getByRole('note').first()).toContainText('نسخة تجريبية')
    // customers never get a way into the staff board from the site itself
    await expect(page.getByRole('link', { name: 'لوحة الكول سنتر' })).toHaveCount(0)
    // the logo is decorative next to the heading that names the restaurant
    await expect(page.locator('main img').first()).toHaveJSProperty('complete', true)
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
    // Whatever section comes first in the menu is the one highlighted on arrival.
    await expect(bar.getByRole('link').first()).toHaveAttribute('aria-current', 'true')
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
    await expect(page.getByText('مغلق، يفتح 11 صباحاً')).toHaveCount(3)
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

// The Artifact viewer scrolls the page's body instead of the window. The active category must
// still follow the scroll and respond to taps there.
test('the category bar works when the page scrolls inside the body, as in the Artifact viewer', async ({ page }) => {
  await page.goto('/branch/ashry')
  await page.getByRole('heading', { level: 2, name: 'المشويات' }).waitFor()
  await page.addStyleTag({ content: 'html { height: 100%; overflow: hidden } body { height: 100%; overflow-y: auto; margin: 0 }' })
  const bar = page.getByRole('navigation', { name: 'أقسام المنيو' })
  await expect(bar.getByRole('link').first()).toHaveAttribute('aria-current', 'true')

  // Tapping a chip selects it and brings its section into view.
  await bar.getByRole('link', { name: 'المشروبات' }).click()
  await expect(bar.getByRole('link', { name: 'المشروبات' })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('heading', { level: 2, name: 'المشروبات' })).toBeInViewport()

  // Scrolling the body by hand moves the highlight too.
  // (a string: the e2e TypeScript project has no DOM types)
  await page.evaluate(`document.body.scrollTo({ top: document.querySelectorAll('main section')[5].getBoundingClientRect().top + document.body.scrollTop - 100 })`)
  await expect(bar.getByRole('link', { name: 'المشروبات' })).not.toHaveAttribute('aria-current', 'true')
})
