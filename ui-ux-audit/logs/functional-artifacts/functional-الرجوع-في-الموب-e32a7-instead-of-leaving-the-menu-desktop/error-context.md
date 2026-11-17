# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional.spec.mjs >> الرجوع في الموبايل >> F20 the phone Back button closes an open item window instead of leaving the menu
- Location: tests/functional.spec.mjs:149:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/branch\/ashry$/
Received string:  "http://localhost:4173/"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="ar" dir="rtl">…</html>
       - unexpected value "http://localhost:4173/"

```

```yaml
- note: "نسخة تجريبية: الطلبات تُحفظ على هذا الجهاز فقط ولا تصل إلى المطعم بعد."
- main:
  - heading "خليها مشاوي" [level=1]
  - paragraph: الشوي على أصوله
  - paragraph: اختر الفرع الأقرب لك لتظهر قائمة طعامه وأسعاره ومناطق توصيله.
  - list:
    - listitem:
      - article:
        - heading "فرع العاشر من رمضان" [level=2]
        - text: مفتوح حتى 12 ليلاً
        - paragraph: أمام نادي الرواد - البوابة الرئيسية - بجوار بنزينة موبيل
        - link "اطلب من فرع العاشر من رمضان":
          - /url: /branch/ashry
          - text: اطلب الآن
        - link "اتصال":
          - /url: tel:0554494299
        - link "الموقع":
          - /url: https://www.google.com/maps/place/%D9%85%D8%B7%D8%B9%D9%85+%D8%AE%D9%84%D9%8A%D9%87%D8%A7+%D9%85%D8%B4%D8%A7%D9%88%D9%8A+(%D9%85%D8%B4%D9%88%D9%8A%D8%A7%D8%AA+-+%D9%85%D9%86%D8%AF%D9%8A)%E2%80%AD/@30.6122187,30.2877589,8z/data=!4m6!3m5!1s0x1457fdede843fb77:0x802a3f8441fb7368!8m2!3d30.2814822!4d31.7518513!16s%2Fg%2F11swd30v6l
    - listitem:
      - article:
        - heading "فرع الزقازيق" [level=2]
        - text: مفتوح حتى 12 ليلاً
        - paragraph: شارع الغشام - برج المدينة المنورة
        - link "اطلب من فرع الزقازيق":
          - /url: /branch/zagazig
          - text: اطلب الآن
        - link "اتصال":
          - /url: tel:0552311777
        - link "الموقع":
          - /url: https://www.google.com/maps/place/%D8%AE%D9%84%D9%8A%D9%87%D8%A7+%D9%85%D8%B4%D8%A7%D9%88%D9%8A+%D9%81%D8%B1%D8%B9+%D8%A7%D9%84%D8%B2%D9%82%D8%A7%D8%B2%D9%8A%D9%82%E2%80%AD/@30.5983495,31.4901034,17z/data=!3m1!4b1!4m6!3m5!1s0x14f7f13dcff7f1eb:0x896ff249f32d2dee!8m2!3d30.5983495!4d31.4901034!16s%2Fg%2F11hzctjtrj
    - listitem:
      - article:
        - heading "فرع التجمع الخامس" [level=2]
        - text: مفتوح حتى 12 ليلاً
        - paragraph: شارع التسعين الشمالي - مول ليروس 1 - مجمع شيل أوت اللوتس
        - link "اطلب من فرع التجمع الخامس":
          - /url: /branch/tagamoa
          - text: اطلب الآن
        - link "اتصال":
          - /url: tel:01008888329
        - link "الموقع":
          - /url: https://www.google.com/maps/place/Khaliha+Mashawy/@30.0300386,31.4848244,15z/data=!3m1!4b1!4m6!3m5!1s0x145823002614fb2f:0x580156fdf11d732b!8m2!3d30.0300399!4d31.5032784!16s%2Fg%2F11x2vqhpzp
- navigation "التنقل الرئيسي":
  - link "الرئيسية":
    - /url: /
  - link "تتبع طلب":
    - /url: /track
  - link "واتساب":
    - /url: https://wa.me/201061005627
- region "Notifications alt+T"
```

# Test source

```ts
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
  88  |     await expect(page.getByRole('button', { name: 'أضف صدور فراخ', exact: true })).toBeVisible()
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
> 153 |     await expect(page).toHaveURL(/\/branch\/ashry$/)
      |                        ^ Error: expect(page).toHaveURL(expected) failed
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
  189 |   })
  190 |   test('F27 an unknown zone has a way out: the branch phone', async ({ page }) => {
  191 |     await checkout(page); await page.getByRole('combobox', { name: 'المنطقة' }).fill('مدينة غير موجودة')
  192 |     await expect(page.getByText(/لا توجد منطقة بهذا الاسم/)).toBeVisible()
  193 |     await expect(page.getByRole('link', { name: '01008888329' })).toHaveAttribute('href', 'tel:01008888329')
  194 |   })
  195 |   test('F28 a closed branch cannot confirm, and says when to come back', async ({ page }) => {
  196 |     await page.clock.setFixedTime(CLOSED); await page.goto('/branch/ashry'); await add(page); await page.goto('/branch/ashry/checkout')
  197 |     await expect(page.getByText(/الفرع مغلق الآن/)).toBeVisible(); await expect(page.getByRole('button', { name: /^تأكيد الطلب/ })).toBeDisabled()
  198 |   })
  199 |   test('F29 confirming shows the order number, empties the cart and remembers the order', async ({ page }) => {
  200 |     await checkout(page, 'ashry'); await fillPickup(page); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  201 |     await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible()
  202 |     await page.goto('/branch/ashry'); await expect(page.getByRole('button', { name: /عرض السلة/ })).toHaveCount(0)
  203 |     await page.goto('/'); await expect(page.getByRole('link', { name: /A-0001/ })).toBeVisible()
  204 |   })
  205 |   test('F30 a fourth order from one phone within 10 minutes is refused with a clear message', async ({ page }) => {
  206 |     for (let i = 0; i < 4; i++) { await checkout(page, 'ashry'); await fillPickup(page, '01011112222'); await page.getByRole('button', { name: /^تأكيد الطلب/ }).click(); if (i < 3) await expect(page.getByRole('heading', { name: 'تم إرسال طلبك' })).toBeVisible() }
  207 |     await expect(page.getByText(/وصلتنا عدة طلبات من نفس الرقم/)).toBeVisible()
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
```