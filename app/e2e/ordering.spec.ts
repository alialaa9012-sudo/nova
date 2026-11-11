import { expect, test, type Page } from '@playwright/test'

// Monday 12:00 Cairo: all branches are open. Date is frozen, timers keep running.
const MONDAY_NOON_CAIRO = new Date('2027-01-04T10:00:00Z')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(MONDAY_NOON_CAIRO)
})

async function addToCart(page: Page, item: string, size: RegExp, expectedButton: string) {
  await page.getByRole('button', { name: `أضف ${item}` }).click()
  const sheet = page.getByRole('dialog', { name: item })
  await sheet.getByRole('radio', { name: size }).click()
  await sheet.getByRole('button', { name: expectedButton }).click()
  await expect(sheet).toBeHidden()
}

test('a delivery order at Tagamoa: zone fee, 14% tax, order number, then the call center moves it', async ({ page, context }) => {
  await page.goto('/branch/tagamoa')
  await addToCart(page, 'صدور فراخ', /^ربع/, 'أضف للسلة · 250 ج.م')

  await page.getByRole('button', { name: /عرض السلة \(1\) · 250 ج.م/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeVisible()

  // Required fields are enforced before anything is sent.
  await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  await expect(page.getByText('اكتب الاسم.')).toBeVisible()
  await expect(page.getByLabel('الاسم')).toBeFocused()

  await page.getByLabel('الاسم').fill('سارة')
  await page.getByLabel('رقم الموبايل').fill('01098765432')
  await page.getByLabel('المنطقة').selectOption({ label: 'اللوتس الشمالية · 75 ج.م' })
  await page.getByLabel('الشارع').fill('شارع التسعين')
  await page.getByLabel('رقم العمارة').fill('12')
  // 250 items + 35 tax (14% of items) + 75 delivery
  await expect(page.getByText('ضريبة 14٪')).toBeVisible()
  await page.getByRole('button', { name: 'تأكيد الطلب · 360 ج.م' }).click()

  await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()
  await expect(page).toHaveURL(/\/order\/T-0001$/)
  const timeline = page.getByRole('list', { name: 'حالة الطلب' })
  await expect(timeline.locator('[aria-current="step"]')).toContainText('طلب جديد')
  await expect(timeline).toContainText('خرج للتوصيل')

  // The call center opens the board in another tab of the same browser (demo mode).
  const admin = await context.newPage()
  await admin.clock.setFixedTime(MONDAY_NOON_CAIRO)
  await admin.goto('/admin')
  const list = admin.getByRole('list', { name: 'قائمة الطلبات' })
  await expect(list.getByRole('heading', { name: 'T-0001' })).toBeVisible()
  await expect(list).toContainText('سارة')
  await list.getByRole('button', { name: 'نقل إلى: تم استلام طلبك وجاري التجهيز' }).click()
  await expect(admin.getByRole('button', { name: 'جاري التجهيز (1)' })).toBeVisible()

  // The customer's page follows the change without a reload.
  await expect(timeline.locator('[aria-current="step"]')).toContainText('تم استلام طلبك وجاري التجهيز')
})

test('a pickup order can be tracked later by number and phone', async ({ page }) => {
  await page.goto('/branch/ashry')
  await addToCart(page, 'صدور فراخ', /^نص/, 'أضف للسلة · 340 ج.م')
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()

  await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
  await expect(page.getByLabel('المنطقة')).toHaveCount(0)
  await page.getByLabel('الاسم').fill('منى')
  await page.getByLabel('رقم الموبايل').fill('٠١١١٢٣٤٥٦٧٨') // Arabic digits are accepted
  await page.getByRole('button', { name: 'تأكيد الطلب · 340 ج.م' }).click()
  await expect(page).toHaveURL(/\/order\/A-0001$/)
  await expect(page.getByRole('list', { name: 'حالة الطلب' })).toContainText('جاهز للاستلام')

  await page.goto('/track')
  await page.getByLabel('رقم الطلب').fill('a-0001')
  await page.getByLabel('رقم الموبايل').fill('01112345678')
  await page.getByRole('button', { name: 'عرض حالة الطلب' }).click()
  await expect(page).toHaveURL(/\/order\/A-0001$/)
  await expect(page.getByRole('list', { name: 'حالة الطلب' })).toBeVisible()

  // A wrong phone does not reveal the order.
  await page.goto('/track')
  await page.getByLabel('رقم الطلب').fill('A-0001')
  await page.getByLabel('رقم الموبايل').fill('01000000000')
  await page.getByRole('button', { name: 'عرض حالة الطلب' }).click()
  await expect(page.getByRole('heading', { name: 'لم نجد هذا الطلب' })).toBeVisible()
})

test('a closed branch lets the customer prepare a cart but not confirm it', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-04T07:00:00Z')) // 09:00 Cairo
  await page.goto('/branch/zagazig')
  await expect(page.getByRole('status').filter({ hasText: 'الفرع مغلق الآن، ويفتح 11 صباحاً' })).toBeVisible()

  await addToCart(page, 'صدور فراخ', /^نص/, 'أضف للسلة · 340 ج.م')
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  const cart = page.getByRole('dialog', { name: 'السلة' })
  await expect(cart.getByRole('button', { name: 'إتمام الطلب' })).toBeDisabled()

  // Even a direct visit to checkout cannot send the order.
  await page.goto('/branch/zagazig/checkout')
  await expect(page.getByRole('alert')).toContainText('الفرع مغلق الآن')
  await expect(page.getByRole('button', { name: /^تأكيد الطلب/ })).toBeDisabled()
})
