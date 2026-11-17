# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional.spec.mjs >> المنيو >> F10 searching «دجاج» finds chicken dishes listed as «فراخ» (synonym)
- Location: tests/functional.spec.mjs:86:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'أضف صدور فراخ', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'أضف صدور فراخ', exact: true }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'أضف صدور فراخ', exact: true })

```

```yaml
- note: "نسخة تجريبية: الطلبات تُحفظ على هذا الجهاز فقط ولا تصل إلى المطعم بعد."
- banner:
  - link "كل الفروع":
    - /url: /
  - img "خليها مشاوي"
  - searchbox "ابحث عن صنف": دجاج
  - button "مسح البحث"
  - button "السلة (0)"
  - heading "منيو فرع العاشر من رمضان" [level=1]
  - text: مفتوح حتى 12 ليلاً
- main:
  - navigation "أقسام المنيو":
    - list:
      - listitem:
        - link "الأطباق الرئيسية":
          - /url: "#wc2"
  - region "الأطباق الرئيسية":
    - heading "الأطباق الرئيسية" [level=2]
    - list:
      - listitem:
        - paragraph: صدور دجاج مشوي وسوتيه
        - button "أضف صدور دجاج مشوي وسوتيه"
- region "Notifications alt+T"
```

# Test source

```ts
  1   | // Every interactive element, with the outcome a user expects. Demo data only: orders live in the browser.
  2   | import { expect, test } from '@playwright/test'
  3   | import { CLOSED, OPEN } from './lib.mjs'
  4   | 
  5   | const fixture = JSON.parse((await import('node:fs')).readFileSync(new URL('../results/fixture-storage.json', import.meta.url), 'utf8'))
  6   | const seed = async (page, data = fixture) => page.addInitScript((d) => { if (!sessionStorage.getItem('s')) { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); sessionStorage.setItem('s', '1') } }, data)
  7   | test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(OPEN) })
  8   | const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
  9   | 
  10  | async function add(page, item = 'صدور فراخ', size = /^ربع/) {
  11  |   await page.getByRole('button', { name: `أضف ${item}`, exact: true }).click()
  12  |   const sheet = page.getByRole('dialog', { name: item })
  13  |   if (size) await sheet.getByRole('radio', { name: size }).click()
  14  |   await sheet.getByRole('button', { name: /^أضف للسلة/ }).click()
  15  |   await expect(sheet).toBeHidden()
  16  | }
  17  | async function checkout(page, branch = 'tagamoa') {
  18  |   await page.goto(`/branch/${branch}`); await add(page)
  19  |   await page.getByRole('button', { name: /عرض السلة/ }).click()
  20  |   await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  21  |   await expect(page.getByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeVisible()
  22  | }
  23  | async function fillPickup(page, phone = '01098765432') {
  24  |   await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
  25  |   await page.getByLabel('الاسم').fill('سارة'); await page.getByLabel('رقم الموبايل').fill(phone)
  26  | }
  27  | 
  28  | test.describe('الرئيسية', () => {
  29  |   test('F01 every «اطلب الآن» opens its own branch menu', async ({ page }) => {
  30  |     for (const [name, id] of [['العاشر من رمضان', 'ashry'], ['الزقازيق', 'zagazig'], ['التجمع الخامس', 'tagamoa']]) {
  31  |       await page.goto('/'); await page.getByRole('link', { name: `اطلب من فرع ${name}` }).click()
  32  |       await expect(page).toHaveURL(new RegExp(`/branch/${id}$`)); await expect(page.getByRole('heading', { level: 1 })).toContainText(name)
  33  |     }
  34  |   })
  35  |   test('F02 call and map buttons point to each branch number and Google Maps in a new tab', async ({ page }) => {
  36  |     await page.goto('/')
  37  |     const calls = await page.getByRole('link', { name: 'اتصال' }).evaluateAll((a) => a.map((e) => e.getAttribute('href')))
  38  |     expect(calls).toEqual(['tel:0554494299', 'tel:0552311777', 'tel:01008888329'])
  39  |     const maps = await page.getByRole('link', { name: 'الموقع' }).evaluateAll((a) => a.map((e) => [e.getAttribute('href'), e.getAttribute('target')]))
  40  |     for (const [h, t] of maps) { expect(h).toMatch(/^https:\/\/(maps\.app\.goo\.gl|www\.google\.com\/maps|goo\.gl)/); expect(t).toBe('_blank') }
  41  |   })
  42  |   test('F03 desktop header: WhatsApp opens wa.me and «تتبع طلب» opens tracking', async ({ page }) => {
  43  |     await page.goto('/')
  44  |     await expect(page.getByRole('link', { name: 'واتساب' }).first()).toHaveAttribute('href', 'https://wa.me/201061005627')
  45  |     await page.getByRole('link', { name: 'تتبع طلب' }).first().click(); await expect(page).toHaveURL(/\/track$/)
  46  |   })
  47  |   test('F04 closed branches say when they open and still let customers browse', async ({ page }) => {
  48  |     await page.clock.setFixedTime(CLOSED); await page.goto('/')
  49  |     await expect(page.getByText('مغلق، يفتح 11 صباحاً')).toHaveCount(3)
  50  |     await page.getByRole('link', { name: 'اطلب من فرع الزقازيق' }).click(); await expect(page).toHaveURL(/zagazig/)
  51  |   })
  52  |   test('F05 the «طلبك الحالي» bar opens the remembered order', async ({ page }) => {
  53  |     await seed(page); await page.goto('/')
  54  |     await page.getByRole('link', { name: /Z-0001/ }).click(); await expect(page).toHaveURL(/\/order\/Z-0001$/)
  55  |     await expect(page.getByText('ملغي').first()).toBeVisible()
  56  |   })
  57  | })
  58  | 
  59  | test.describe('الرئيسية على الموبايل', () => {
  60  |   test.use(mobile)
  61  |   test('F06 bottom bar: home, tracking and WhatsApp', async ({ page }) => {
  62  |     await page.goto('/track')
  63  |     const nav = page.getByRole('navigation').last()
  64  |     await expect(nav.getByRole('link', { name: 'واتساب' })).toHaveAttribute('href', /wa\.me/)
  65  |     await nav.getByRole('link', { name: 'الرئيسية' }).click(); await expect(page).toHaveURL(/\/$/)
  66  |     await page.getByRole('navigation').last().getByRole('link', { name: 'تتبع طلب' }).click(); await expect(page).toHaveURL(/\/track$/)
  67  |   })
  68  | })
  69  | 
  70  | test.describe('المنيو', () => {
  71  |   test('F07 «كل الفروع» goes back home', async ({ page }) => {
  72  |     await page.goto('/branch/ashry'); await page.getByRole('link', { name: 'كل الفروع' }).first().click(); await expect(page).toHaveURL(/\/$/)
  73  |   })
  74  |   test('F08 search narrows by name, tolerates spelling, clears with ×', async ({ page }) => {
  75  |     await page.goto('/branch/ashry'); const box = page.getByRole('searchbox')
  76  |     await box.fill('كفته'); await expect(page.getByRole('button', { name: 'أضف كفتة فراخ', exact: true })).toBeVisible()
  77  |     await expect(page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })).toHaveCount(0)
  78  |     await page.getByRole('button', { name: 'مسح البحث' }).first().click(); await expect(box).toHaveValue('')
  79  |     await expect(page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })).toBeVisible()
  80  |   })
  81  |   test('F09 a search with no result says so and offers to clear it', async ({ page }) => {
  82  |     await page.goto('/branch/ashry'); await page.getByRole('searchbox').fill('بيتزا')
  83  |     await expect(page.getByText(/لا يوجد صنف|لا توجد نتائج/)).toBeVisible()
  84  |     await page.getByRole('button', { name: 'مسح البحث' }).last().click(); await expect(page.getByRole('searchbox')).toHaveValue('')
  85  |   })
  86  |   test('F10 searching «دجاج» finds chicken dishes listed as «فراخ» (synonym)', async ({ page }) => {
  87  |     await page.goto('/branch/ashry'); await page.getByRole('searchbox').fill('دجاج')
> 88  |     await expect(page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })).toBeVisible()
      |                                                                                    ^ Error: expect(locator).toBeVisible() failed
  89  |   })
  90  |   test('F11 a category chip scrolls to its section and highlights itself', async ({ page }) => {
  91  |     await page.goto('/branch/ashry'); const bar = page.getByRole('navigation', { name: 'أقسام المنيو' })
  92  |     await bar.getByRole('link', { name: 'المشروبات' }).click()
  93  |     await expect(bar.getByRole('link', { name: 'المشروبات' })).toHaveAttribute('aria-current', 'true')
  94  |     await expect(page.getByRole('heading', { level: 2, name: 'المشروبات' })).toBeInViewport()
  95  |   })
  96  |   test('F12 sizes show their prices and the add button follows size and quantity', async ({ page }) => {
  97  |     await page.goto('/branch/ashry'); await page.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click()
  98  |     const s = page.getByRole('dialog', { name: 'صدور فراخ' })
  99  |     await expect(s.getByRole('radio')).toHaveCount(4)
  100 |     await s.getByRole('radio', { name: /^نص/ }).click(); await expect(s.getByRole('button', { name: /^أضف للسلة/ })).toContainText('340')
  101 |     await s.getByRole('button', { name: 'زيادة الكمية' }).click(); await expect(s.getByRole('button', { name: /^أضف للسلة/ })).toContainText('680')
  102 |     await expect(s.getByRole('button', { name: 'تقليل الكمية' })).toBeEnabled()
  103 |     await s.getByRole('button', { name: 'تقليل الكمية' }).click(); await expect(s.getByRole('button', { name: 'تقليل الكمية' })).toBeDisabled()
  104 |   })
  105 |   test('F13 an item note is optional, counted and capped at 120 characters', async ({ page }) => {
  106 |     await page.goto('/branch/ashry'); await page.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click()
  107 |     const s = page.getByRole('dialog', { name: 'صدور فراخ' })
  108 |     await s.getByRole('button', { name: /أضف ملاحظة/ }).click(); const box = s.getByRole('textbox')
  109 |     await box.fill('س'.repeat(150)); await expect(box).toHaveValue('س'.repeat(120)); await expect(s.getByText('120 / 120')).toBeVisible()
  110 |     await s.getByRole('button', { name: 'حذف الملاحظة' }).click(); await expect(s.getByRole('textbox')).toHaveCount(0)
  111 |   })
  112 |   test('F14 adding shows a confirmation and the cart bar with count and total', async ({ page }) => {
  113 |     await page.goto('/branch/ashry'); await add(page)
  114 |     await expect(page.getByText(/أُضيف صدور فراخ/)).toBeVisible()
  115 |     await expect(page.getByRole('button', { name: /عرض السلة \(1\) · 170/ })).toBeVisible()
  116 |   })
  117 |   test('F15 booking-only items offer a call instead of add', async ({ page }) => {
  118 |     await page.goto('/branch/tagamoa')
  119 |     await expect(page.getByRole('link', { name: /احجز كتف/ })).toHaveAttribute('href', /^tel:/)
  120 |     await expect(page.getByRole('button', { name: 'أضف كتف', exact: true })).toHaveCount(0)
  121 |   })
  122 |   test('F16 cart: quantity, total, delete and the empty state', async ({ page }) => {
  123 |     await page.goto('/branch/ashry'); await add(page); await add(page, 'كفتة فراخ')
  124 |     await page.getByRole('button', { name: /عرض السلة/ }).click(); const cart = page.getByRole('dialog', { name: 'السلة' })
  125 |     await cart.getByRole('button', { name: /زيادة كمية صدور فراخ/ }).click(); await expect(cart).toContainText('2')
  126 |     await cart.getByRole('button', { name: /حذف صدور فراخ/ }).click(); await cart.getByRole('button', { name: /حذف كفتة فراخ/ }).click()
  127 |     await expect(cart.getByText(/السلة فارغة/)).toBeVisible()
  128 |   })
  129 |   test('F17 the cart survives a reload and stays separate per branch', async ({ page }) => {
  130 |     await page.goto('/branch/ashry'); await add(page); await page.reload()
  131 |     await expect(page.getByRole('button', { name: /عرض السلة \(1\)/ })).toBeVisible()
  132 |     await page.goto('/branch/zagazig'); await expect(page.getByRole('button', { name: /عرض السلة/ })).toHaveCount(0)
  133 |   })
  134 |   test('F18 closed branch: cart explains and blocks checkout', async ({ page }) => {
  135 |     await page.clock.setFixedTime(CLOSED); await page.goto('/branch/ashry'); await add(page)
  136 |     await page.getByRole('button', { name: /عرض السلة/ }).click(); const cart = page.getByRole('dialog', { name: 'السلة' })
  137 |     await expect(cart.getByText(/الفرع مغلق الآن/)).toBeVisible()
  138 |     await expect(cart.getByRole('link', { name: 'إتمام الطلب' }).or(cart.getByRole('button', { name: 'إتمام الطلب' }))).toBeDisabled()
  139 |   })
  140 |   test('F19 Escape closes the item window and focus returns to the item', async ({ page }) => {
  141 |     await page.goto('/branch/ashry'); const plus = page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })
  142 |     await plus.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible()
  143 |     await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden(); await expect(plus).toBeFocused()
  144 |   })
  145 | })
  146 | 
  147 | test.describe('الرجوع في الموبايل', () => {
  148 |   test.use(mobile)
  149 |   test('F20 the phone Back button closes an open item window instead of leaving the menu', async ({ page }) => {
  150 |     await page.goto('/'); await page.getByRole('link', { name: 'اطلب من فرع العاشر من رمضان' }).click()
  151 |     await page.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible()
  152 |     await page.goBack()
  153 |     await expect(page).toHaveURL(/\/branch\/ashry$/)
  154 |   })
  155 | })
  156 | 
  157 | test.describe('إتمام الطلب', () => {
  158 |   test('F21 empty cart: the page says so and leads back to the menu', async ({ page }) => {
  159 |     await page.goto('/branch/ashry/checkout'); await expect(page.getByRole('heading', { name: 'السلة فارغة' })).toBeVisible()
  160 |     await page.getByRole('link', { name: 'العودة للمنيو' }).click(); await expect(page).toHaveURL(/\/branch\/ashry$/)
  161 |   })
  162 |   test('F22 missing fields: one clear message each and focus on the first', async ({ page }) => {
  163 |     await checkout(page); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  164 |     for (const m of ['اكتب الاسم.', 'اكتب رقم موبايل صحيح من 11 رقماً يبدأ بـ 01.', 'اختر المنطقة.', 'اكتب اسم الشارع.', 'اكتب رقم العمارة.']) await expect(page.getByText(m)).toBeVisible()
  165 |     await expect(page.getByLabel('الاسم')).toBeFocused()
  166 |   })
  167 |   test('F23 phone: Arabic digits accepted, wrong prefix refused', async ({ page }) => {
  168 |     await checkout(page, 'ashry'); await page.getByRole('radio', { name: 'استلام من الفرع' }).click(); await page.getByLabel('الاسم').fill('سارة')
  169 |     await page.getByLabel('رقم الموبايل').fill('0201234567'); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  170 |     await expect(page.getByText('اكتب رقم موبايل صحيح من 11 رقماً يبدأ بـ 01.')).toBeVisible()
  171 |     await page.getByLabel('رقم الموبايل').fill('٠١٠٩٨٧٦٥٤٣٢'); await expect(page.getByText('اكتب رقم موبايل صحيح من 11 رقماً يبدأ بـ 01.')).toHaveCount(0)
  172 |     await page.getByRole('button', { name: /^تأكيد الطلب/ }).click(); await expect(page).toHaveURL(/\/order\/A-\d{4}$/)
  173 |   })
  174 |   test('F24 zone fee and the 14% Tagamoa tax appear before confirming', async ({ page }) => {
  175 |     await checkout(page); await expect(page.getByText('ضريبة 14٪')).toBeVisible()
  176 |     await page.getByRole('combobox', { name: 'المنطقة' }).fill('اللوتس الشمالية'); await page.getByRole('option').first().click()
  177 |     await expect(page.getByRole('button', { name: /^تأكيد الطلب/ })).toContainText('360')
  178 |   })
  179 |   test('F25 pickup hides the address and shows the branch address', async ({ page }) => {
  180 |     await checkout(page, 'ashry'); await page.getByRole('radio', { name: 'استلام من الفرع' }).click()
  181 |     await expect(page.getByLabel('الشارع')).toHaveCount(0); await expect(page.getByText(/تستلم طلبك من الفرع/)).toBeVisible()
  182 |   })
  183 |   test('F26 what was typed survives a reload and the trip back to the menu', async ({ page }) => {
  184 |     await checkout(page); await page.getByLabel('الاسم').fill('سارة'); await page.getByLabel('الشارع').fill('شارع التسعين')
  185 |     await page.reload(); await expect(page.getByLabel('الاسم')).toHaveValue('سارة')
  186 |     await page.getByRole('link', { name: 'رجوع للمنيو' }).click(); await page.getByRole('button', { name: /عرض السلة/ }).click()
  187 |     await page.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  188 |     await expect(page.getByLabel('الشارع')).toHaveValue('شارع التسعين')
```