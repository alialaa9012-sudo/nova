import { expect, test } from '@playwright/test'

// Monday 12:00 Cairo: all branches are open. Date is frozen, timers keep running.
const MONDAY_NOON_CAIRO = new Date('2027-01-04T10:00:00Z')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(MONDAY_NOON_CAIRO)
})

test('the admin adds a delivery zone to one branch and a customer orders to it', async ({ page }) => {
  // Reach the board from the demo banner, then the zones tab.
  await page.goto('/')
  await page.getByRole('link', { name: 'لوحة الكول سنتر' }).click()
  await page.getByRole('link', { name: 'مناطق التوصيل' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'مناطق التوصيل' })).toBeVisible()

  await page.getByRole('button', { name: 'فرع التجمع الخامس' }).click()
  await expect(page.getByRole('heading', { name: 'مناطق فرع التجمع الخامس (71)' })).toBeVisible()

  // An existing zone is refused, also with a different spelling.
  await page.getByLabel('اسم المنطقة', { exact: true }).fill('اللوتس الشماليه')
  await page.getByLabel('رسوم التوصيل (ج.م)').fill('80')
  await page.getByRole('button', { name: 'إضافة المنطقة' }).click()
  await expect(page.getByText('هذه المنطقة موجودة بالفعل في هذا الفرع.')).toBeVisible()

  await page.getByLabel('اسم المنطقة', { exact: true }).fill('مدينتي')
  await page.getByLabel('رسوم التوصيل (ج.م)').fill('١٥٠') // Arabic digits are accepted
  await page.getByRole('button', { name: 'إضافة المنطقة' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'أُضيفت «مدينتي» إلى فرع التجمع الخامس برسوم 150 ج.م.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'مناطق فرع التجمع الخامس (72)' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'قائمة المناطق' }).getByRole('listitem').first()).toContainText('مدينتي')

  // It survives a reload and stays out of the other branches.
  await page.reload()
  await page.getByRole('button', { name: 'فرع التجمع الخامس' }).click()
  await expect(page.getByRole('heading', { name: 'مناطق فرع التجمع الخامس (72)' })).toBeVisible()
  await page.getByRole('button', { name: 'فرع الزقازيق' }).click()
  await expect(page.getByRole('heading', { name: 'مناطق فرع الزقازيق (73)' })).toBeVisible()
  await page.getByLabel('بحث باسم المنطقة').fill('مدينتي')
  await expect(page.getByText('لا توجد منطقة بهذا الاسم.')).toBeVisible()

  // The customer orders to the new zone: 250 items + 35 tax + 150 delivery.
  await page.getByRole('link', { name: 'واجهة العميل' }).click()
  await page.getByRole('link', { name: 'اطلب من فرع التجمع الخامس' }).click()
  await page.getByRole('button', { name: 'أضف صدور فراخ' }).click()
  await page.getByRole('dialog', { name: 'صدور فراخ' }).getByRole('button', { name: 'أضف للسلة · 250 ج.م' }).click()
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await page.getByLabel('الاسم').fill('سارة')
  await page.getByLabel('رقم الموبايل').fill('01098765432')
  await page.getByLabel('المنطقة').selectOption({ label: 'مدينتي · 150 ج.م' })
  await page.getByLabel('الشارع').fill('شارع 1')
  await page.getByLabel('رقم العمارة').fill('5')
  await page.getByRole('button', { name: 'تأكيد الطلب · 435 ج.م' }).click()
  await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()
  await expect(page.getByText('العنوان: مدينتي، شارع 1، عمارة 5')).toBeVisible()

  // Deleting needs a second click, and the placed order keeps its zone and fee.
  await page.goto('/admin/zones')
  await page.getByRole('button', { name: 'فرع التجمع الخامس' }).click()
  await page.getByRole('button', { name: 'حذف مدينتي' }).click()
  await page.getByRole('button', { name: 'تأكيد الحذف' }).click()
  await expect(page.getByRole('heading', { name: 'مناطق فرع التجمع الخامس (71)' })).toBeVisible()
  await page.getByRole('link', { name: 'الطلبات', exact: true }).click()
  await expect(page.getByRole('list', { name: 'قائمة الطلبات' })).toContainText('مدينتي')
  await expect(page.getByRole('list', { name: 'قائمة الطلبات' })).toContainText('435 ج.م')
})

test('a zone the branch file left without one price gets a price and reaches customers', async ({ page }) => {
  await page.goto('/admin/zones')
  await page.getByRole('button', { name: 'فرع الزقازيق' }).click()
  await expect(page.getByRole('heading', { name: 'مناطق تحتاج سعراً (8)' })).toBeVisible()

  await page.getByRole('button', { name: 'حدد السعر: شرويدة' }).click()
  await expect(page.getByLabel('اسم المنطقة', { exact: true })).toHaveValue('شرويدة')
  await expect(page.getByLabel('رسوم التوصيل (ج.م)')).toBeFocused()
  await page.getByLabel('رسوم التوصيل (ج.م)').fill('45')
  await page.getByRole('button', { name: 'إضافة المنطقة' }).click()
  await expect(page.getByRole('heading', { name: 'مناطق تحتاج سعراً (7)' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'مناطق فرع الزقازيق (74)' })).toBeVisible()
})
