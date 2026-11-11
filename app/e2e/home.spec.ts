import { expect, test } from '@playwright/test'

test.describe('home page', () => {
  test('renders the RTL Arabic UI and the quantity controls work', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('طلبات المطعم')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'طلبات المطعم',
    )
    await expect(page.getByRole('button', { name: /فرع/ })).toHaveCount(3)

    await page.getByRole('button', { name: 'زيادة الكمية' }).click()
    await expect(page.getByTestId('quantity')).toHaveText('1')
  })
})
