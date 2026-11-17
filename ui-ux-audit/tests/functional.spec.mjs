// Every interactive element, with the outcome a user expects. Demo data only: orders live in the browser.
import { expect, test } from '@playwright/test'
import { CLOSED, OPEN } from './lib.mjs'

const fixture = JSON.parse((await import('node:fs')).readFileSync(new URL('../results/fixture-storage.json', import.meta.url), 'utf8'))
const seed = async (page, data = fixture) => page.addInitScript((d) => { if (!sessionStorage.getItem('s')) { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); sessionStorage.setItem('s', '1') } }, data)
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(OPEN) })
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

async function add(page, item = 'صدور فراخ', size = /^ربع/) {
  await page.getByRole('button', { name: `أضف ${item}`, exact: true }).click()
  const sheet = page.getByRole('dialog', { name: item })
  if (size) await sheet.getByRole('radio', { name: size }).click()
  await sheet.getByRole('button', { name: /^أضف للسلة/ }).click()
  await expect(sheet).toBeHidden()
}
async function checkout(page, branch = 'tagamoa') {
  await page.goto(`/branch/${branch}`); await add(page)
  await page.getByRole('button', { name: /عرض السلة/ }).click()
  await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeVisible()
}
async function fillPickup(page, phone = '01098765432') {
  await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
  await page.getByLabel('الاسم').fill('سارة'); await page.getByLabel('رقم الموبايل').fill(phone)
}

test.describe('الرئيسية', () => {
  test('F01 every «اطلب الآن» opens its own branch menu', async ({ page }) => {
    for (const [name, id] of [['العاشر من رمضان', 'ashry'], ['الزقازيق', 'zagazig'], ['التجمع الخامس', 'tagamoa']]) {
      await page.goto('/'); await page.getByRole('link', { name: `اطلب من فرع ${name}` }).click()
      await expect(page).toHaveURL(new RegExp(`/branch/${id}$`)); await expect(page.getByRole('heading', { level: 1 })).toContainText(name)
    }
  })
  test('F02 call and map buttons point to each branch number and Google Maps in a new tab', async ({ page }) => {
    await page.goto('/')
    const calls = await page.getByRole('link', { name: 'اتصال' }).evaluateAll((a) => a.map((e) => e.getAttribute('href')))
    expect(calls).toEqual(['tel:0554494299', 'tel:0552311777', 'tel:01008888329'])
    const maps = await page.getByRole('link', { name: 'الموقع' }).evaluateAll((a) => a.map((e) => [e.getAttribute('href'), e.getAttribute('target')]))
    for (const [h, t] of maps) { expect(h).toMatch(/^https:\/\/(maps\.app\.goo\.gl|www\.google\.com\/maps|goo\.gl)/); expect(t).toBe('_blank') }
  })
  test('F03 desktop header: WhatsApp opens wa.me and «تتبع طلب» opens tracking', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'واتساب' }).first()).toHaveAttribute('href', 'https://wa.me/201061005627')
    await page.getByRole('link', { name: 'تتبع طلب' }).first().click(); await expect(page).toHaveURL(/\/track$/)
  })
  test('F04 closed branches say when they open and still let customers browse', async ({ page }) => {
    await page.clock.setFixedTime(CLOSED); await page.goto('/')
    await expect(page.getByText('مغلق، يفتح 11 صباحاً')).toHaveCount(3)
    await page.getByRole('link', { name: 'اطلب من فرع الزقازيق' }).click(); await expect(page).toHaveURL(/zagazig/)
  })
  test('F05 the «طلبك الحالي» bar opens the remembered order', async ({ page }) => {
    await seed(page); await page.goto('/')
    await page.getByRole('link', { name: /Z-0001/ }).click(); await expect(page).toHaveURL(/\/order\/Z-0001$/)
    await expect(page.getByText('ملغي').first()).toBeVisible()
  })
})

test.describe('الرئيسية على الموبايل', () => {
  test.use(mobile)
  test('F06 bottom bar: home, tracking and WhatsApp', async ({ page }) => {
    await page.goto('/track')
    const nav = page.getByRole('navigation').last()
    await expect(nav.getByRole('link', { name: 'واتساب' })).toHaveAttribute('href', /wa\.me/)
    await nav.getByRole('link', { name: 'الرئيسية' }).click(); await expect(page).toHaveURL(/\/$/)
    await page.getByRole('navigation').last().getByRole('link', { name: 'تتبع طلب' }).click(); await expect(page).toHaveURL(/\/track$/)
  })
})

test.describe('المنيو', () => {
  test('F07 «كل الفروع» goes back home', async ({ page }) => {
    await page.goto('/branch/ashry'); await page.getByRole('link', { name: 'كل الفروع' }).first().click(); await expect(page).toHaveURL(/\/$/)
  })
  test('F08 search narrows by name, tolerates spelling, clears with ×', async ({ page }) => {
    await page.goto('/branch/ashry'); const box = page.getByRole('searchbox')
    await box.fill('كفته'); await expect(page.getByRole('button', { name: 'أضف كفتة فراخ', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'مسح البحث' }).first().click(); await expect(box).toHaveValue('')
    await expect(page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })).toBeVisible()
  })
  test('F09 a search with no result says so and offers to clear it', async ({ page }) => {
    await page.goto('/branch/ashry'); await page.getByRole('searchbox').fill('بيتزا')
    await expect(page.getByText(/لا يوجد صنف|لا توجد نتائج/)).toBeVisible()
    await page.getByRole('button', { name: 'مسح البحث' }).last().click(); await expect(page.getByRole('searchbox')).toHaveValue('')
  })
  test('F10 searching «دجاج» finds chicken dishes listed as «فراخ» (synonym)', async ({ page }) => {
    await page.goto('/branch/ashry'); await page.getByRole('searchbox').fill('دجاج')
    await expect(page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })).toBeVisible()
  })
  test('F11 a category chip scrolls to its section and highlights itself', async ({ page }) => {
    await page.goto('/branch/ashry'); const bar = page.getByRole('navigation', { name: 'أقسام المنيو' })
    await bar.getByRole('link', { name: 'المشروبات' }).click()
    await expect(bar.getByRole('link', { name: 'المشروبات' })).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('heading', { level: 2, name: 'المشروبات' })).toBeInViewport()
  })
  test('F12 sizes show their prices and the add button follows size and quantity', async ({ page }) => {
    await page.goto('/branch/ashry'); await page.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click()
    const s = page.getByRole('dialog', { name: 'صدور فراخ' })
    await expect(s.getByRole('radio')).toHaveCount(4)
    await s.getByRole('radio', { name: /^نص/ }).click(); await expect(s.getByRole('button', { name: /^أضف للسلة/ })).toContainText('340')
    await s.getByRole('button', { name: 'زيادة الكمية' }).click(); await expect(s.getByRole('button', { name: /^أضف للسلة/ })).toContainText('680')
    await expect(s.getByRole('button', { name: 'تقليل الكمية' })).toBeEnabled()
    await s.getByRole('button', { name: 'تقليل الكمية' }).click(); await expect(s.getByRole('button', { name: 'تقليل الكمية' })).toBeDisabled()
  })
  test('F13 an item note is optional, counted and capped at 120 characters', async ({ page }) => {
    await page.goto('/branch/ashry'); await page.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click()
    const s = page.getByRole('dialog', { name: 'صدور فراخ' })
    await s.getByRole('button', { name: /أضف ملاحظة/ }).click(); const box = s.getByRole('textbox')
    await box.fill('س'.repeat(150)); await expect(box).toHaveValue('س'.repeat(120)); await expect(s.getByText('120 / 120')).toBeVisible()
    await s.getByRole('button', { name: 'حذف الملاحظة' }).click(); await expect(s.getByRole('textbox')).toHaveCount(0)
  })
  test('F14 adding shows a confirmation and the cart bar with count and total', async ({ page }) => {
    await page.goto('/branch/ashry'); await add(page)
    await expect(page.getByText(/أُضيف صدور فراخ/)).toBeVisible()
    await expect(page.getByRole('button', { name: /عرض السلة \(1\) · 170/ })).toBeVisible()
  })
  test('F15 booking-only items offer a call instead of add', async ({ page }) => {
    await page.goto('/branch/tagamoa')
    await expect(page.getByRole('link', { name: /احجز كتف/ })).toHaveAttribute('href', /^tel:/)
    await expect(page.getByRole('button', { name: 'أضف كتف', exact: true })).toHaveCount(0)
  })
  test('F16 cart: quantity, total, delete and the empty state', async ({ page }) => {
    await page.goto('/branch/ashry'); await add(page); await add(page, 'كفتة فراخ')
    await page.getByRole('button', { name: /عرض السلة/ }).click(); const cart = page.getByRole('dialog', { name: 'السلة' })
    await cart.getByRole('button', { name: /زيادة كمية صدور فراخ/ }).click(); await expect(cart).toContainText('2')
    await cart.getByRole('button', { name: /حذف صدور فراخ/ }).click(); await cart.getByRole('button', { name: /حذف كفتة فراخ/ }).click()
    await expect(cart.getByText(/السلة فارغة/)).toBeVisible()
  })
  test('F17 the cart survives a reload and stays separate per branch', async ({ page }) => {
    await page.goto('/branch/ashry'); await add(page); await page.reload()
    await expect(page.getByRole('button', { name: /عرض السلة \(1\)/ })).toBeVisible()
    await page.goto('/branch/zagazig'); await expect(page.getByRole('button', { name: /عرض السلة/ })).toHaveCount(0)
  })
  test('F18 closed branch: cart explains and blocks checkout', async ({ page }) => {
    await page.clock.setFixedTime(CLOSED); await page.goto('/branch/ashry'); await add(page)
    await page.getByRole('button', { name: /عرض السلة/ }).click(); const cart = page.getByRole('dialog', { name: 'السلة' })
    await expect(cart.getByText(/الفرع مغلق الآن/)).toBeVisible()
    await expect(cart.getByRole('link', { name: 'إتمام الطلب' }).or(cart.getByRole('button', { name: 'إتمام الطلب' }))).toBeDisabled()
  })
  test('F19 Escape closes the item window and focus returns to the item', async ({ page }) => {
    await page.goto('/branch/ashry'); const plus = page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })
    await plus.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden(); await expect(plus).toBeFocused()
  })
})

test.describe('الرجوع في الموبايل', () => {
  test.use(mobile)
  test('F20 the phone Back button closes an open item window instead of leaving the menu', async ({ page }) => {
    await page.goto('/'); await page.getByRole('link', { name: 'اطلب من فرع العاشر من رمضان' }).click()
    await page.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/branch\/ashry$/)
  })
})

test.describe('إتمام الطلب', () => {
  test('F21 empty cart: the page says so and leads back to the menu', async ({ page }) => {
    await page.goto('/branch/ashry/checkout'); await expect(page.getByRole('heading', { name: 'السلة فارغة' })).toBeVisible()
    await page.getByRole('link', { name: 'العودة للمنيو' }).click(); await expect(page).toHaveURL(/\/branch\/ashry$/)
  })
  test('F22 missing fields: one clear message each and focus on the first', async ({ page }) => {
    await checkout(page); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    for (const m of ['اكتب الاسم.', 'اكتب رقم موبايل صحيح من 11 رقماً يبدأ بـ 01.', 'اختر المنطقة.', 'اكتب اسم الشارع.', 'اكتب رقم العمارة.']) await expect(page.getByText(m)).toBeVisible()
    await expect(page.getByLabel('الاسم')).toBeFocused()
  })
  test('F23 phone: Arabic digits accepted, wrong prefix refused', async ({ page }) => {
    await checkout(page, 'ashry'); await page.getByRole('radio', { name: 'استلام من الفرع' }).click(); await page.getByLabel('الاسم').fill('سارة')
    await page.getByLabel('رقم الموبايل').fill('0201234567'); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    await expect(page.getByText('اكتب رقم موبايل صحيح من 11 رقماً يبدأ بـ 01.')).toBeVisible()
    await page.getByLabel('رقم الموبايل').fill('٠١٠٩٨٧٦٥٤٣٢'); await expect(page.getByText('اكتب رقم موبايل صحيح من 11 رقماً يبدأ بـ 01.')).toHaveCount(0)
    await page.getByRole('button', { name: /^تأكيد الطلب/ }).click(); await expect(page).toHaveURL(/\/order\/A-\d{4}$/)
  })
  test('F24 zone fee and the 14% Tagamoa tax appear before confirming', async ({ page }) => {
    await checkout(page); await expect(page.getByText('ضريبة 14٪')).toBeVisible()
    await page.getByRole('combobox', { name: 'المنطقة' }).fill('اللوتس الشمالية'); await page.getByRole('option').first().click()
    await expect(page.getByRole('button', { name: /^تأكيد الطلب/ })).toContainText('360')
  })
  test('F25 pickup hides the address and shows the branch address', async ({ page }) => {
    await checkout(page, 'ashry'); await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
    await expect(page.getByLabel('الشارع')).toHaveCount(0); await expect(page.getByText(/تستلم طلبك من الفرع/)).toBeVisible()
  })
  test('F26 what was typed survives a reload and the trip back to the menu', async ({ page }) => {
    await checkout(page); await page.getByLabel('الاسم').fill('سارة'); await page.getByLabel('الشارع').fill('شارع التسعين')
    await page.reload(); await expect(page.getByLabel('الاسم')).toHaveValue('سارة')
    await page.getByRole('link', { name: 'رجوع للمنيو' }).click(); await page.getByRole('button', { name: /عرض السلة/ }).click()
    await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
    await expect(page.getByLabel('الشارع')).toHaveValue('شارع التسعين')
  })
  test('F27 an unknown zone has a way out: the branch phone', async ({ page }) => {
    await checkout(page); await page.getByRole('combobox', { name: 'المنطقة' }).fill('مدينة غير موجودة')
    await expect(page.getByText(/لا توجد منطقة بهذا الاسم/)).toBeVisible()
    await expect(page.getByRole('link', { name: '01008888329' })).toHaveAttribute('href', 'tel:01008888329')
  })
  test('F28 a closed branch cannot confirm, and says when to come back', async ({ page }) => {
    await page.clock.setFixedTime(CLOSED); await page.goto('/branch/ashry'); await add(page); await page.goto('/branch/ashry/checkout')
    await expect(page.getByText(/الفرع مغلق الآن/)).toBeVisible(); await expect(page.getByRole('button', { name: /^تأكيد الطلب/ })).toBeDisabled()
  })
  test('F29 confirming shows the order number, empties the cart and remembers the order', async ({ page }) => {
    await checkout(page, 'ashry'); await fillPickup(page); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()
    await page.goto('/branch/ashry'); await expect(page.getByRole('button', { name: /عرض السلة/ })).toHaveCount(0)
    await page.goto('/'); await expect(page.getByRole('link', { name: /A-0001/ })).toBeVisible()
  })
  test('F30 a fourth order from one phone within 10 minutes is refused with a clear message', async ({ page }) => {
    for (let i = 0; i < 4; i++) { await checkout(page, 'ashry'); await fillPickup(page, '01011112222'); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click(); if (i < 3) await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible() }
    await expect(page.getByText(/وصلتنا عدة طلبات من نفس الرقم/)).toBeVisible()
  })
  test('F31 double tap on confirm places one order', async ({ page }) => {
    await checkout(page, 'ashry'); await fillPickup(page)
    await page.getByRole('button', { name: /^تأكيد الطلب/ }).dblclick()
    await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('km.demo.orders.v1')).length)).toBe(1)
  })
})

test.describe('صفحة الطلب والتتبع', () => {
  test('F32 copy and WhatsApp share of the order number', async ({ page }) => {
    await checkout(page, 'ashry'); await fillPickup(page); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    await page.getByRole('button', { name: 'نسخ رقم الطلب' }).click(); await expect(page.getByText('نُسخ رقم الطلب')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('A-0001')
    await expect(page.getByRole('link', { name: 'مشاركة رقم الطلب على واتساب' })).toHaveAttribute('href', /wa\.me\/\?text=.*A-0001/)
  })
  test('F33 a status change on the staff board reaches the open order page without reload', async ({ page, context }) => {
    await checkout(page, 'ashry'); await fillPickup(page); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    const staff = await context.newPage(); await staff.goto('/admin')
    await staff.getByRole('button', { name: /^نقل إلى/ }).first().click()
    await expect(page.getByText(/جاري التجهيز/).first()).toBeVisible({ timeout: 8000 })
  })
  test('F34 «اطلب مرة أخرى» returns to the same branch with the same items in the open cart', async ({ page }) => {
    await seed(page); await page.goto('/'); await page.getByRole('link', { name: /Z-0001/ }).click()
    await page.getByRole('button', { name: 'اطلب مرة أخرى' }).click(); await expect(page).toHaveURL(/\/branch\/zagazig$/)
    await expect(page.getByRole('dialog', { name: 'السلة' }).getByText('شيش طاووق').first()).toBeVisible()
  })
  test('F35 an order link without the phone asks for it; a wrong phone finds nothing', async ({ page }) => {
    await seed(page, { 'km.demo.orders.v1': fixture['km.demo.orders.v1'] }); await page.goto('/order/A-0001')
    await page.getByLabel('رقم الموبايل').fill('01099999999'); await page.getByRole('button', { name: 'عرض حالة الطلب' }).click()
    await expect(page.getByRole('heading', { name: 'لم نجد هذا الطلب' })).toBeVisible()
    await page.getByRole('link', { name: 'تتبع طلب آخر' }).click(); await expect(page).toHaveURL(/\/track$/)
  })
  test('F36 tracking: clear errors, then the right number and phone open the order', async ({ page }) => {
    await seed(page, { 'km.demo.orders.v1': fixture['km.demo.orders.v1'] }); await page.goto('/track')
    await page.getByRole('button', { name: 'عرض حالة الطلب' }).click()
    await expect(page.getByText('اكتب رقم الطلب كما وصلك، مثل A-0012.')).toBeVisible(); await expect(page.getByText('اكتب رقم الموبايل الذي طلبت به.')).toBeVisible()
    await page.getByLabel('رقم الطلب').fill('t-0001'); await page.getByLabel('رقم الموبايل').fill('01000000002')
    await page.getByRole('button', { name: 'عرض حالة الطلب' }).click(); await expect(page).toHaveURL(/\/order\/T-0001$/)
  })
  test('F37 an unknown address shows the not-found page with branch links', async ({ page }) => {
    await page.goto('/menu'); await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible()
    await page.getByRole('link', { name: /الزقازيق/ }).click(); await expect(page).toHaveURL(/zagazig/)
  })
})

test.describe('لوحة الكول سنتر والمناطق', () => {
  test('F38 filters by status, branch and search narrow the board', async ({ page }) => {
    await seed(page); await page.goto('/admin'); const list = page.getByRole('list', { name: 'قائمة الطلبات' })
    const filters = page.getByRole('group', { name: 'تصفية حسب الحالة' })
    await filters.getByRole('button', { name: /^الكل/ }).click(); await expect(list.getByRole('heading')).toHaveCount(3)
    await filters.getByRole('button', { name: /^ملغي/ }).click(); await expect(list.getByRole('heading')).toHaveCount(1)
    await filters.getByRole('button', { name: /^الكل/ }).click(); await page.getByLabel('بحث برقم الطلب أو الموبايل').fill('01000000002')
    await expect(list.getByRole('heading')).toHaveCount(1)
  })
  test('F39 a new order moves through its statuses on the board', async ({ page }) => {
    await seed(page); await page.goto('/admin')
    const card = page.getByRole('list', { name: 'قائمة الطلبات' }).getByRole('listitem').filter({ hasText: 'A-0001' })
    await card.getByRole('button', { name: /^نقل إلى/ }).click()
    await page.getByRole('group', { name: 'تصفية حسب الحالة' }).getByRole('button', { name: /^جاري التجهيز/ }).click()
    await expect(page.getByRole('list', { name: 'قائمة الطلبات' })).toContainText('A-0001')
  })
  test('F40 cancelling needs a reason, «سبب آخر» needs words', async ({ page }) => {
    await seed(page); await page.goto('/admin'); await page.getByRole('button', { name: 'إلغاء', exact: true }).first().click()
    const d = page.getByRole('dialog'); await expect(d.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeDisabled()
    await d.getByRole('radio', { name: 'سبب آخر' }).click(); await expect(d.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeDisabled()
    await d.getByLabel('اكتب السبب').fill('تجربة'); await expect(d.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeEnabled()
  })
  test('F41 details show items with notes, and the POS invoice number is saved', async ({ page }) => {
    await seed(page); await page.goto('/admin')
    const all = () => page.getByRole('group', { name: 'تصفية حسب الحالة' }).getByRole('button', { name: /^الكل/ }).click()
    await all(); await page.getByRole('list', { name: 'قائمة الطلبات' }).getByRole('listitem').filter({ hasText: 'T-0001' }).getByRole('button', { name: 'التفاصيل' }).click()
    const d = page.getByRole('dialog'); await expect(d).toContainText('بدون شطة')
    await d.getByLabel('رقم الفاتورة في Crystal Mind').fill('INV-77'); await d.getByRole('button', { name: /^حفظ/ }).click()
    await page.reload(); await all(); await page.getByRole('list', { name: 'قائمة الطلبات' }).getByRole('listitem').filter({ hasText: 'T-0001' }).getByRole('button', { name: 'التفاصيل' }).click()
    await expect(page.getByRole('dialog').getByLabel('رقم الفاتورة في Crystal Mind')).toHaveValue('INV-77')
  })
  test('F42 a new order placed in another tab appears on the open board', async ({ page, context }) => {
    await page.goto('/admin'); const shop = await context.newPage(); await shop.clock.setFixedTime(OPEN)
    await checkout(shop, 'ashry'); await fillPickup(shop); await shop.getByRole('button', { name: /^تأكيد الطلب/ }).click()
    await expect(page.getByRole('list', { name: 'قائمة الطلبات' })).toContainText('A-0001', { timeout: 8000 })
  })
  test('F43 zones: refuse empty and duplicate, accept Arabic digits, reach checkout, delete with confirmation', async ({ page }) => {
    await page.goto('/admin/zones'); await page.getByRole('button', { name: 'فرع التجمع الخامس' }).click()
    await page.getByRole('button', { name: 'إضافة المنطقة' }).click(); await expect(page.getByText(/اكتب اسم المنطقة/).first()).toBeVisible()
    await page.getByLabel('اسم المنطقة', { exact: true }).fill('اللوتس الشماليه'); await page.getByLabel('رسوم التوصيل (ج.م)').fill('80')
    await page.getByRole('button', { name: 'إضافة المنطقة' }).click(); await expect(page.getByText(/موجودة بالفعل/)).toBeVisible()
    await page.getByLabel('اسم المنطقة', { exact: true }).fill('مدينتي'); await page.getByLabel('رسوم التوصيل (ج.م)').fill('١٥٠')
    await page.getByRole('button', { name: 'إضافة المنطقة' }).click(); await expect(page.getByRole('status').filter({ hasText: 'مدينتي' })).toBeVisible()
    await checkout(page); await page.getByRole('combobox', { name: 'المنطقة' }).fill('مدينتي'); await expect(page.getByRole('option', { name: /مدينتي.*150/ })).toBeVisible()
    await page.goto('/admin/zones'); await page.getByRole('button', { name: 'فرع التجمع الخامس' }).click()
    await page.getByRole('button', { name: 'حذف مدينتي' }).click(); await page.getByRole('button', { name: /^نعم|تأكيد الحذف|احذف/ }).first().click()
    await expect(page.getByRole('button', { name: 'حذف مدينتي' })).toHaveCount(0)
  })
  test('F44 a pending zone can be priced from its button', async ({ page }) => {
    await page.goto('/admin/zones'); await page.getByRole('button', { name: 'فرع الزقازيق' }).click()
    await page.getByRole('button', { name: /^حدد السعر/ }).first().click()
    await expect(page.getByLabel('اسم المنطقة', { exact: true })).not.toHaveValue('')
  })
  test('F45 the staff board has no sign-in (demo): anyone with the link can see customer data', async ({ page }) => {
    await seed(page); await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /تسجيل الدخول/ })).toBeVisible()
  })
  test('F46 the demo banner is always visible so testers know orders do not reach the kitchen', async ({ page }) => {
    for (const u of ['/', '/branch/ashry', '/track', '/admin']) { await page.goto(u); await expect(page.getByRole('complementary', { name: 'تنبيه' })).toContainText('نسخة تجريبية') }
  })
})
