# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional.spec.mjs >> لوحة الكول سنتر والمناطق >> F45 the staff board has no sign-in (demo): anyone with the link can see customer data
- Location: tests/functional.spec.mjs:306:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /تسجيل الدخول/ })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /تسجيل الدخول/ }) with timeout 5000ms
  - waiting for getByRole('heading', { name: /تسجيل الدخول/ })

```

```yaml
- note: "نسخة تجريبية: الطلبات تُحفظ على هذا الجهاز فقط ولا تصل إلى المطعم بعد."
- banner:
  - img "خليها مشاوي"
  - paragraph: لوحة الكول سنتر
  - navigation "أقسام اللوحة":
    - list:
      - listitem:
        - link "الطلبات":
          - /url: /admin
      - listitem:
        - link "مناطق التوصيل":
          - /url: /admin/zones
- main:
  - heading "الطلبات" [level=1]
  - text: الفرع
  - combobox "الفرع":
    - option "كل الفروع" [selected]
    - option "العاشر من رمضان"
    - option "الزقازيق"
    - option "التجمع الخامس"
  - text: التاريخ
  - textbox "التاريخ": 2027-01-04
  - text: بحث برقم الطلب أو الموبايل
  - searchbox "بحث برقم الطلب أو الموبايل"
  - group "تصفية حسب الحالة":
    - button "جديد (1)" [pressed]
    - button "جاري التجهيز (1)"
    - button "خرج / جاهز للاستلام (0)"
    - button "ملغي (1)"
    - button "الكل (3)"
  - list "قائمة الطلبات":
    - listitem:
      - heading "A-0001" [level=2]
      - text: فرع العاشر من رمضان استلام منذ 0 دقيقة طلب جديد · 4 يناير، 12:00 م
      - paragraph:
        - text: عميل تجريبي أ ·
        - link "01000000001":
          - /url: tel:01000000001
      - list:
        - listitem: 1 × صدور فراخ (ربع) 170 ج.م
      - paragraph: 170 ج.م كاش
      - 'button "نقل إلى: تم استلام طلبك وجاري التجهيز"'
      - button "التفاصيل"
      - button "إلغاء"
- region "Notifications alt+T"
```

# Test source

```ts
  208 |   })
  209 |   test('F31 double tap on confirm places one order', async ({ page }) => {
  210 |     await checkout(page, 'ashry'); await fillPickup(page)
  211 |     await page.getByRole('button', { name: /^تأكيد الطلب/ }).dblclick()
  212 |     await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()
  213 |     expect(await page.evaluate(() => JSON.parse(localStorage.getItem('km.demo.orders.v1')).length)).toBe(1)
  214 |   })
  215 | })
  216 | 
  217 | test.describe('صفحة الطلب والتتبع', () => {
  218 |   test('F32 copy and WhatsApp share of the order number', async ({ page }) => {
  219 |     await checkout(page, 'ashry'); await fillPickup(page); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  220 |     await page.getByRole('button', { name: 'نسخ رقم الطلب' }).click(); await expect(page.getByText('نُسخ رقم الطلب')).toBeVisible()
  221 |     expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('A-0001')
  222 |     await expect(page.getByRole('link', { name: 'مشاركة رقم الطلب على واتساب' })).toHaveAttribute('href', /wa\.me\/\?text=.*A-0001/)
  223 |   })
  224 |   test('F33 a status change on the staff board reaches the open order page without reload', async ({ page, context }) => {
  225 |     await checkout(page, 'ashry'); await fillPickup(page); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  226 |     const staff = await context.newPage(); await staff.goto('/admin')
  227 |     await staff.getByRole('button', { name: /^نقل إلى/ }).first().click()
  228 |     await expect(page.getByText(/جاري التجهيز/).first()).toBeVisible({ timeout: 8000 })
  229 |   })
  230 |   test('F34 «اطلب مرة أخرى» returns to the same branch menu', async ({ page }) => {
  231 |     await seed(page); await page.goto('/'); await page.getByRole('link', { name: /Z-0001/ }).click()
  232 |     await page.getByRole('link', { name: 'اطلب مرة أخرى' }).click(); await expect(page).toHaveURL(/\/branch\/zagazig$/)
  233 |   })
  234 |   test('F35 an order link without the phone asks for it; a wrong phone finds nothing', async ({ page }) => {
  235 |     await seed(page, { 'km.demo.orders.v1': fixture['km.demo.orders.v1'] }); await page.goto('/order/A-0001')
  236 |     await page.getByLabel('رقم الموبايل').fill('01099999999'); await page.getByRole('button', { name: 'عرض حالة الطلب' }).click()
  237 |     await expect(page.getByRole('heading', { name: 'لم نجد هذا الطلب' })).toBeVisible()
  238 |     await page.getByRole('link', { name: 'تتبع طلب آخر' }).click(); await expect(page).toHaveURL(/\/track$/)
  239 |   })
  240 |   test('F36 tracking: clear errors, then the right number and phone open the order', async ({ page }) => {
  241 |     await seed(page, { 'km.demo.orders.v1': fixture['km.demo.orders.v1'] }); await page.goto('/track')
  242 |     await page.getByRole('button', { name: 'عرض حالة الطلب' }).click()
  243 |     await expect(page.getByText('اكتب رقم الطلب كما وصلك، مثل A-0012.')).toBeVisible(); await expect(page.getByText('اكتب رقم الموبايل الذي طلبت به.')).toBeVisible()
  244 |     await page.getByLabel('رقم الطلب').fill('t-0001'); await page.getByLabel('رقم الموبايل').fill('01000000002')
  245 |     await page.getByRole('button', { name: 'عرض حالة الطلب' }).click(); await expect(page).toHaveURL(/\/order\/T-0001$/)
  246 |   })
  247 |   test('F37 an unknown address shows the not-found page with branch links', async ({ page }) => {
  248 |     await page.goto('/menu'); await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible()
  249 |     await page.getByRole('link', { name: /الزقازيق/ }).click(); await expect(page).toHaveURL(/zagazig/)
  250 |   })
  251 | })
  252 | 
  253 | test.describe('لوحة الكول سنتر والمناطق', () => {
  254 |   test('F38 filters by status, branch and search narrow the board', async ({ page }) => {
  255 |     await seed(page); await page.goto('/admin'); const list = page.getByRole('list', { name: 'قائمة الطلبات' })
  256 |     const filters = page.getByRole('group', { name: 'تصفية حسب الحالة' })
  257 |     await filters.getByRole('button', { name: /^الكل/ }).click(); await expect(list.getByRole('heading')).toHaveCount(3)
  258 |     await filters.getByRole('button', { name: /^ملغي/ }).click(); await expect(list.getByRole('heading')).toHaveCount(1)
  259 |     await filters.getByRole('button', { name: /^الكل/ }).click(); await page.getByLabel('بحث برقم الطلب أو الموبايل').fill('01000000002')
  260 |     await expect(list.getByRole('heading')).toHaveCount(1)
  261 |   })
  262 |   test('F39 a new order moves through its statuses on the board', async ({ page }) => {
  263 |     await seed(page); await page.goto('/admin')
  264 |     const card = page.getByRole('list', { name: 'قائمة الطلبات' }).getByRole('listitem').filter({ hasText: 'A-0001' })
  265 |     await card.getByRole('button', { name: /^نقل إلى/ }).click()
  266 |     await page.getByRole('group', { name: 'تصفية حسب الحالة' }).getByRole('button', { name: /^جاري التجهيز/ }).click()
  267 |     await expect(page.getByRole('list', { name: 'قائمة الطلبات' })).toContainText('A-0001')
  268 |   })
  269 |   test('F40 cancelling needs a reason, «سبب آخر» needs words', async ({ page }) => {
  270 |     await seed(page); await page.goto('/admin'); await page.getByRole('button', { name: 'إلغاء', exact: true }).first().click()
  271 |     const d = page.getByRole('dialog'); await expect(d.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeDisabled()
  272 |     await d.getByRole('radio', { name: 'سبب آخر' }).click(); await expect(d.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeDisabled()
  273 |     await d.getByLabel('اكتب السبب').fill('تجربة'); await expect(d.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeEnabled()
  274 |   })
  275 |   test('F41 details show items with notes, and the POS invoice number is saved', async ({ page }) => {
  276 |     await seed(page); await page.goto('/admin')
  277 |     const all = () => page.getByRole('group', { name: 'تصفية حسب الحالة' }).getByRole('button', { name: /^الكل/ }).click()
  278 |     await all(); await page.getByRole('list', { name: 'قائمة الطلبات' }).getByRole('listitem').filter({ hasText: 'T-0001' }).getByRole('button', { name: 'التفاصيل' }).click()
  279 |     const d = page.getByRole('dialog'); await expect(d).toContainText('بدون شطة')
  280 |     await d.getByLabel('رقم الفاتورة في Crystal Mind').fill('INV-77'); await d.getByRole('button', { name: /^حفظ/ }).click()
  281 |     await page.reload(); await all(); await page.getByRole('list', { name: 'قائمة الطلبات' }).getByRole('listitem').filter({ hasText: 'T-0001' }).getByRole('button', { name: 'التفاصيل' }).click()
  282 |     await expect(page.getByRole('dialog').getByLabel('رقم الفاتورة في Crystal Mind')).toHaveValue('INV-77')
  283 |   })
  284 |   test('F42 a new order placed in another tab appears on the open board', async ({ page, context }) => {
  285 |     await page.goto('/admin'); const shop = await context.newPage(); await shop.clock.setFixedTime(OPEN)
  286 |     await checkout(shop, 'ashry'); await fillPickup(shop); await shop.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  287 |     await expect(page.getByRole('list', { name: 'قائمة الطلبات' })).toContainText('A-0001', { timeout: 8000 })
  288 |   })
  289 |   test('F43 zones: refuse empty and duplicate, accept Arabic digits, reach checkout, delete with confirmation', async ({ page }) => {
  290 |     await page.goto('/admin/zones'); await page.getByRole('button', { name: 'فرع التجمع الخامس' }).click()
  291 |     await page.getByRole('button', { name: 'إضافة المنطقة' }).click(); await expect(page.getByText(/اكتب اسم المنطقة/).first()).toBeVisible()
  292 |     await page.getByLabel('اسم المنطقة', { exact: true }).fill('اللوتس الشماليه'); await page.getByLabel('رسوم التوصيل (ج.م)').fill('80')
  293 |     await page.getByRole('button', { name: 'إضافة المنطقة' }).click(); await expect(page.getByText(/موجودة بالفعل/)).toBeVisible()
  294 |     await page.getByLabel('اسم المنطقة', { exact: true }).fill('مدينتي'); await page.getByLabel('رسوم التوصيل (ج.م)').fill('١٥٠')
  295 |     await page.getByRole('button', { name: 'إضافة المنطقة' }).click(); await expect(page.getByRole('status').filter({ hasText: 'مدينتي' })).toBeVisible()
  296 |     await checkout(page); await page.getByRole('combobox', { name: 'المنطقة' }).fill('مدينتي'); await expect(page.getByRole('option', { name: /مدينتي.*150/ })).toBeVisible()
  297 |     await page.goto('/admin/zones'); await page.getByRole('button', { name: 'فرع التجمع الخامس' }).click()
  298 |     await page.getByRole('button', { name: 'حذف مدينتي' }).click(); await page.getByRole('button', { name: /^نعم|تأكيد الحذف|احذف/ }).first().click()
  299 |     await expect(page.getByRole('button', { name: 'حذف مدينتي' })).toHaveCount(0)
  300 |   })
  301 |   test('F44 a pending zone can be priced from its button', async ({ page }) => {
  302 |     await page.goto('/admin/zones'); await page.getByRole('button', { name: 'فرع الزقازيق' }).click()
  303 |     await page.getByRole('button', { name: /^حدد السعر/ }).first().click()
  304 |     await expect(page.getByLabel('اسم المنطقة', { exact: true })).not.toHaveValue('')
  305 |   })
  306 |   test('F45 the staff board has no sign-in (demo): anyone with the link can see customer data', async ({ page }) => {
  307 |     await seed(page); await page.goto('/admin')
> 308 |     await expect(page.getByRole('heading', { name: /تسجيل الدخول/ })).toBeVisible()
      |                                                                       ^ Error: expect(locator).toBeVisible() failed
  309 |   })
  310 |   test('F46 the demo banner is always visible so testers know orders do not reach the kitchen', async ({ page }) => {
  311 |     for (const u of ['/', '/branch/ashry', '/track', '/admin']) { await page.goto(u); await expect(page.getByRole('note')).toContainText('نسخة تجريبية') }
  312 |   })
  313 | })
  314 | 
```