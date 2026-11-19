import { expect, test, type Page } from '@playwright/test'
import { MONDAY_NOON_CAIRO, pickZone } from './helpers.ts'

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
  await pickZone(page, 'اللوتس الشمالية')
  await expect(page.getByRole('combobox', { name: 'المنطقة' })).toHaveValue('اللوتس الشمالية · 75 ج.م')
  await page.getByLabel('الشارع').fill('شارع التسعين')
  await page.getByLabel('رقم العمارة').fill('12')
  // 250 items + 35 tax (14% of items) + 75 delivery
  await expect(page.getByText('ضريبة 14٪')).toBeVisible()
  await page.getByRole('button', { name: 'تأكيد الطلب · 360 ج.م' }).click()

  await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()
  await expect(page).toHaveURL(/\/order\/01$/)
  const timeline = page.getByRole('list', { name: 'حالة الطلب' })
  await expect(timeline.locator('[aria-current="step"]')).toContainText('طلب جديد')
  await expect(timeline).toContainText('خرج للتوصيل')

  // The call center opens the board in another tab of the same browser (demo mode).
  const admin = await context.newPage()
  await admin.clock.setFixedTime(MONDAY_NOON_CAIRO)
  await admin.goto('/admin')
  const list = admin.getByRole('list', { name: 'قائمة الطلبات' })
  await expect(list.getByRole('heading', { name: '#01' })).toBeVisible()
  await expect(list).toContainText('سارة')
  await list.getByRole('button', { name: 'قبول الطلب' }).click()
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
  await expect(page).toHaveURL(/\/order\/01$/)
  await expect(page.getByRole('list', { name: 'حالة الطلب' })).toContainText('جاهز للاستلام')

  await page.goto('/track')
  await page.getByLabel('رقم الطلب').fill('#01')
  await page.getByLabel('رقم الموبايل').fill('01112345678')
  await page.getByRole('button', { name: 'عرض حالة الطلب' }).click()
  await expect(page).toHaveURL(/\/order\/01$/)
  await expect(page.getByRole('list', { name: 'حالة الطلب' })).toBeVisible()

  // A wrong phone does not reveal the order.
  await page.goto('/track')
  await page.getByLabel('رقم الطلب').fill('01')
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

// Runs in the page (a string because the e2e TypeScript project has no DOM types): is the
// fourth zone option the element a tap at its centre would actually hit, without scrolling?
const FOURTH_OPTION_IS_TAPPABLE = `(() => {
  const option = document.querySelectorAll('[role="option"]')[3]
  if (!option) return false
  const box = option.getBoundingClientRect()
  return option.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
})()`

test('the open zone list is never hidden behind the confirm bar', async ({ page }) => {
  await page.goto('/branch/tagamoa')
  await addToCart(page, 'صدور فراخ', /^ربع/, 'أضف للسلة · 250 ج.م')
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()

  const zone = page.getByRole('combobox', { name: 'المنطقة' })
  await zone.fill('ال') // many zones match
  const options = page.getByRole('option')
  await expect(options.nth(3)).toBeVisible()
  await expect.poll(() => page.evaluate(FOURTH_OPTION_IS_TAPPABLE)).toBe(true)
  // the field label stays readable above the list
  await expect(page.getByText('المنطقة', { exact: true })).toBeInViewport({ ratio: 1 })

  const name = await options.nth(3).locator('span').first().innerText()
  await options.nth(3).click()
  await expect(zone).toHaveValue(new RegExp(`^${name} · `))
})

test('three taps on confirm in the same instant still place one order', async ({ page }) => {
  await page.goto('/branch/ashry')
  await addToCart(page, 'صدور فراخ', /^ربع/, 'أضف للسلة · 170 ج.م')
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
  await page.getByLabel('الاسم').fill('سارة')
  await page.getByLabel('رقم الموبايل').fill('01098765432')
  // Synchronous clicks land before React can redraw the button as disabled.
  await page.getByRole('button', { name: /^تأكيد الطلب/ }).evaluate((el) => {
    const button = el as unknown as { click(): void }
    for (let i = 0; i < 3; i++) button.click()
  })
  await expect(page).toHaveURL(/\/order\/01$/)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('km.demo.orders.v1') ?? '[]').length)
  expect(stored).toBe(1)
})

test('closing an item window with Escape puts focus back on the item it came from', async ({ page }) => {
  await page.goto('/branch/ashry')
  const plus = page.getByRole('button', { name: 'أضف كفتة فراخ' })
  await plus.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'كفتة فراخ' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'كفتة فراخ' })).toBeHidden()
  await expect(plus).toBeFocused()
})

test('the phone Back button closes an open window instead of leaving the menu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'اطلب من فرع العاشر من رمضان' }).click()
  await page.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'صدور فراخ' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/branch\/ashry$/)
  // Closing with Escape leaves no extra history entry: one Back now goes home.
  await page.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
})

test('Back from checkout returns to the menu with the cart closed', async ({ page }) => {
  await page.goto('/branch/ashry')
  await addToCart(page, 'صدور فراخ', /^ربع/, 'أضف للسلة · 170 ج.م')
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/branch\/ashry$/)
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /عرض السلة/ })).toBeVisible()
})

test('«اطلب مرة أخرى» puts the same items back in the cart and opens it', async ({ page }) => {
  await page.goto('/branch/ashry')
  await addToCart(page, 'صدور فراخ', /^ربع/, 'أضف للسلة · 170 ج.م')
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
  await page.getByLabel('الاسم').fill('سارة')
  await page.getByLabel('رقم الموبايل').fill('01098765432')
  await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  await page.getByRole('button', { name: 'اطلب مرة أخرى' }).click()
  await expect(page).toHaveURL(/\/branch\/ashry$/)
  const cart = page.getByRole('dialog', { name: 'السلة' })
  await expect(cart).toBeVisible()
  await expect(cart.getByText('صدور فراخ').first()).toBeVisible()
})

test('searching «دجاج» finds the chicken dishes', async ({ page }) => {
  await page.goto('/branch/ashry')
  await page.getByRole('searchbox').fill('دجاج')
  await expect(page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })).toBeVisible()
})

test('the board rings until an order is accepted, times it, and closes it as delivered', async ({ page, context }) => {
  await context.grantPermissions(['notifications'])
  const admin = await context.newPage()
  await admin.clock.setFixedTime(MONDAY_NOON_CAIRO)
  await admin.goto('/admin')
  await expect(admin.getByText('لا توجد طلبات بهذه التصفية.')).toBeVisible()
  await expect(admin).toHaveTitle('لوحة الكول سنتر | خليها مشاوي')

  const order = async (phone: string) => {
    await page.goto('/branch/ashry')
    await addToCart(page, 'صدور فراخ', /^نص/, 'أضف للسلة · 340 ج.م')
    await page.getByRole('button', { name: /عرض السلة/ }).click()
    await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
    await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
    await page.getByLabel('الاسم').fill('منى')
    await page.getByLabel('رقم الموبايل').fill(phone)
    await page.getByRole('button', { name: 'تأكيد الطلب · 340 ج.م' }).click()
  }
  // A customer orders in another tab: the board shows it and its tab title counts it.
  await order('01112345678')
  await expect(page).toHaveURL(/\/order\/01$/)
  await expect(page.getByText('بعد قبول الطلب يكون جاهزاً للاستلام خلال 30 إلى 45 دقيقة.')).toBeVisible()
  const list = admin.getByRole('list', { name: 'قائمة الطلبات' })
  await expect(list.getByRole('heading', { name: '#01' })).toBeVisible()
  await expect(admin).toHaveTitle('(1) طلب جديد · لوحة الكول سنتر | خليها مشاوي')

  // Sound and notifications are switched on from the board; using the board does not silence it.
  await admin.getByRole('button', { name: 'تفعيل الصوت والتنبيهات' }).click()
  await expect(admin.getByRole('button', { name: 'تفعيل الصوت والتنبيهات' })).toHaveCount(0)
  await expect(admin).toHaveTitle('(1) طلب جديد · لوحة الكول سنتر | خليها مشاوي')

  // Accepting stops the ringing and starts the 30 to 45 minute pickup clock.
  await list.getByRole('button', { name: 'قبول الطلب' }).click()
  await expect(admin).toHaveTitle('لوحة الكول سنتر | خليها مشاوي')
  await admin.getByRole('button', { name: 'جاري التجهيز (1)' }).click()
  await expect(list).toContainText('باقي 45 دقيقة')
  await expect(list).toContainText('جاهز للاستلام من 12:30 م إلى 12:45 م')
  await expect(page.getByText('الوقت المتوقع: جاهز للاستلام من 12:30 م إلى 12:45 م.')).toBeVisible()

  // Ready early, then handed over: the order ends under «تم التسليم» with no cancel button.
  await list.getByRole('button', { name: 'جاهز للاستلام الآن' }).click()
  await admin.getByRole('button', { name: 'خرج / جاهز للاستلام (1)' }).click()
  await list.getByRole('button', { name: 'تم التسليم' }).click()
  await admin.getByRole('button', { name: 'تم التسليم (1)' }).click()
  await expect(list.getByRole('heading', { name: '#01' })).toBeVisible()
  await expect(list.getByRole('button', { name: 'إلغاء' })).toHaveCount(0)
  // The customer sees three steps only, with no «تم التسليم» and no times.
  const steps = page.getByRole('list', { name: 'حالة الطلب' })
  await expect(steps.locator('[aria-current="step"]')).toContainText('جاهز للاستلام')
  await expect(steps).not.toContainText('تم التسليم')
  await expect(steps).not.toContainText(/\d{1,2}:\d{2}/)

  // A second order is cancelled from the board and moves to «ملغي» straight away.
  await order('01112345679')
  await admin.getByRole('button', { name: 'جديد (1)' }).click()
  await list.getByRole('button', { name: 'إلغاء' }).click()
  const dialog = admin.getByRole('dialog', { name: /إلغاء الطلب/ })
  await dialog.getByRole('radio').first().click()
  await dialog.getByRole('button', { name: 'تأكيد الإلغاء' }).click()
  await expect(admin.getByRole('button', { name: 'جديد (0)' })).toBeVisible()
  await expect(admin.getByRole('button', { name: 'ملغي (1)' })).toBeVisible()
})

test('an accepted order moves on by itself when its preparation time is up', async ({ page, context }) => {
  const admin = await context.newPage()
  await page.goto('/branch/tagamoa')
  await addToCart(page, 'صدور فراخ', /^ربع/, 'أضف للسلة · 250 ج.م')
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await page.getByLabel('الاسم').fill('سارة')
  await page.getByLabel('رقم الموبايل').fill('01098765432')
  await pickZone(page, 'اللوتس الشمالية')
  await page.getByLabel('الشارع').fill('شارع التسعين')
  await page.getByLabel('رقم العمارة').fill('12')
  await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  await expect(page).toHaveURL(/\/order\/01$/)

  await admin.goto('/admin')
  const list = admin.getByRole('list', { name: 'قائمة الطلبات' })
  await list.getByRole('button', { name: 'قبول الطلب' }).click()
  await admin.getByRole('button', { name: 'جاري التجهيز (1)' }).click()
  await expect(list).toContainText('يخرج للتوصيل الساعة 12:45 م')

  // 45 minutes later the delivery order is «خرج للتوصيل» without anyone pressing a button. (The test
  // clock is shared by the tabs; «online» makes the board look now instead of on its next tick.)
  await admin.clock.setFixedTime(new Date(MONDAY_NOON_CAIRO.getTime() + 45 * 60_000))
  await admin.evaluate("dispatchEvent(new Event('online'))")
  await expect(admin.getByRole('button', { name: 'خرج / جاهز للاستلام (1)' })).toBeVisible()
})
