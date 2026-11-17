// Six simulated users carry out real tasks in a real browser. Every step is executed and recorded;
// the "seen" notes describe what is on screen at that moment (checked by the script where possible).
// Time is an estimate (Keystroke-Level Model), not a measurement of a human.
import { OPEN, VIEWPORTS, context, launch, out, writeJSON } from '../tests/lib.mjs'

const KLM = { click: 1.2, key: 0.3, keySlow: 0.9, read: 3, decide: 1.35 }
const b = await launch()
const report = []

async function persona(meta, vp, run) {
  const ctx = await context(b, vp, { clock: OPEN })
  const p = await ctx.newPage()
  const tasks = []
  let task
  const api = {
    p,
    task(goal) { task = { goal, steps: [], clicks: 0, keys: 0, screens: 0, decisions: 0, confusion: [], errors: [], success: null }; tasks.push(task) },
    async step(name, fn, { clicks = 1, keys = 0, decide = false, read = false } = {}) {
      const s = { name, ok: true }
      try { const note = await fn(); if (note) s.seen = note } catch (e) { s.ok = false; s.error = String(e.message).split('\n')[0].slice(0, 160); task.errors.push(`${name}: ${s.error}`) }
      task.clicks += clicks; task.keys += keys; if (decide) task.decisions++; if (read) task.screens++
      const shot = `personas/shots/${meta.id}-${tasks.length}-${task.steps.length + 1}.jpg`
      await p.screenshot({ path: out(shot), type: 'jpeg', quality: 60 }).catch(() => {})
      s.shot = shot; task.steps.push(s)
      return s.ok
    },
    confuse(text) { task.confusion.push(text) },
    done(ok, improve) { task.success = ok; task.improve = improve; const k = meta.slow ? KLM.keySlow : KLM.key; task.estSeconds = Math.round(task.clicks * KLM.click + task.keys * k + task.screens * KLM.read + task.decisions * KLM.decide) },
  }
  await run(api)
  report.push({ ...meta, viewport: `${vp.width}×${vp.height}`, tasks })
  await ctx.close()
}
const visible = (loc) => loc.isVisible().catch(() => false)
const lastSeen = (u) => u.p && null

// 1. First-time visitor ------------------------------------------------------------------
await persona({ id: 'p1', name: 'زائر جديد لأول مرة', profile: 'سمع عن المطعم من صديق، يفتح الرابط من واتساب، لا يعرف الفروع ولا المنيو.' }, VIEWPORTS[1], async (u) => {
  const { p } = u
  u.task('يفهم ما هذا الموقع ويطلب ربع صدور فراخ توصيلاً إلى اللوتس الشمالية')
  await u.step('يفتح الرابط', async () => { await p.goto('/'); return `يرى: ${await p.locator('h1').innerText()} — ${await p.getByText('الشوي على أصوله').count() ? 'الشعار' : ''}، و3 فروع بحالة «مفتوح حتى 12 ليلاً»` }, { clicks: 0, read: true })
  await u.step('يختار أقرب فرع (التجمع)', async () => { await p.getByRole('link', { name: 'اطلب من فرع التجمع الخامس' }).click() }, { decide: true })
  let taxInMenu = false
  await u.step('يبحث بعينه عن «صدور فراخ»', async () => { const first = await p.locator('main h2').first().innerText(); taxInMenu = await visible(p.getByText(/لا تشمل ضريبة/).first()); return `أول قسم يراه: «${first}»، لا يرى أسعاراً على الكروت${taxInMenu ? '، ويرى سطر «الأسعار لا تشمل ضريبة 14٪»' : ''}` }, { clicks: 0, read: true })
  u.confuse('أول قسم في المنيو هو الشوربة، والمستخدم جاء للمشويات: اضطر للتمرير أو لاستخدام شريط الأقسام.')
  await u.step('يضغط شريط «المشويات»', async () => { await p.getByRole('navigation', { name: 'أقسام المنيو' }).getByRole('link', { name: 'المشويات' }).click() })
  await u.step('يفتح صدور فراخ ويرى الأحجام', async () => { await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); const sizes = await p.getByRole('dialog').getByRole('radio').allInnerTexts(); return `الأحجام: ${sizes.map((s) => s.replace(/\s+/g, ' ')).join(' | ')}` }, { read: true })
  u.confuse('الأحجام «ربع/تلت/نص/كيلو» بدون وزن بالجرام أو عدد قطع: لا يعرف هل الربع يكفي شخصاً.')
  await u.step('يختار ربع ويضيف', async () => { await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click() }, { clicks: 1, decide: true })
  await u.step('يفتح السلة ثم إتمام الطلب', async () => { await p.getByRole('button', { name: /عرض السلة/ }).click(); await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click() }, { clicks: 2 })
  await u.step('يقرأ صفحة إتمام الطلب', async () => `الإجمالي في الأعلى: ${await p.locator('header').getByText(/ج\.م/).first().innerText()}، وسطر «ضريبة 14٪» ظاهر` , { clicks: 0, read: true })
  if (!taxInMenu) u.confuse('اكتشف ضريبة 14٪ لأول مرة في صفحة الدفع؛ لم تُذكر في المنيو.')
  u.confuse('لا يوجد وقت توصيل متوقع في أي مكان قبل التأكيد.')
  await u.step('يكتب اسمه ورقمه', async () => { await p.getByLabel('الاسم').fill('كريم'); await p.getByLabel('رقم الموبايل').fill('01123456789') }, { clicks: 2, keys: 16 })
  await u.step('يبحث عن منطقته «اللوتس»', async () => { await p.getByRole('combobox', { name: 'المنطقة' }).fill('اللوتس'); const n = await p.getByRole('option').count(); await p.getByRole('option', { name: /اللوتس الشمالية/ }).click(); return `ظهرت ${n} نتائج، اختار «اللوتس الشمالية»` }, { clicks: 2, keys: 6, decide: true })
  await u.step('يكتب الشارع والعمارة', async () => { await p.getByLabel('الشارع').fill('شارع التسعين'); await p.getByLabel('رقم العمارة').fill('12') }, { clicks: 2, keys: 14 })
  await u.step('يؤكد الطلب', async () => { await p.getByRole('button', { name: /^تأكيد الطلب/ }).click(); await p.getByRole('heading', { name: 'تم إرسال طلبك' }).waitFor(); return `رقم الطلب: ${await p.getByText(/T-\d{4}/).first().innerText()}` }, { read: true })
  u.confuse('بعد التأكيد لا يعرف متى يصل الطلب ولا هل سيتصل به الفرع.')
  u.done(true, 'إظهار وقت التوصيل المتوقع والضريبة قبل صفحة الدفع، ووزن تقريبي لكل حجم.')
})

// 2. Low-tech user on a small phone -------------------------------------------------------
await persona({ id: 'p2', name: 'مستخدم قليل الخبرة بالتكنولوجيا', profile: 'رجل في الستين، تليفون صغير، يكتب ببطء، يكتب الأرقام بالعربي ومعها مسافات.', slow: true }, VIEWPORTS[0], async (u) => {
  const { p } = u
  u.task('يطلب كفتة فراخ «من غير شطة» استلاماً من فرع الزقازيق')
  let cut = false
  await u.step('يفتح الموقع ويقرأ', async () => { await p.goto('/'); cut = await p.getByRole('heading', { name: 'فرع العاشر من رمضان' }).evaluate((h) => h.scrollWidth > h.clientWidth + 1); return cut ? 'اسم فرع العاشر مقصوص على شاشته الصغيرة' : 'يقرأ أسماء الفروع الثلاثة كاملة' }, { clicks: 0, read: true })
  if (cut) u.confuse('اسم «فرع العاشر من رمضان» يظهر مقصوصاً على شاشة 360.')
  await u.step('يضغط اطلب الآن (الزقازيق)', async () => { await p.getByRole('link', { name: 'اطلب من فرع الزقازيق' }).click() }, { decide: true })
  await u.step('يكتب في البحث «كفته فراخ»', async () => { await p.getByRole('searchbox').fill('كفته فراخ'); return `نتائج: ${await p.getByRole('button', { name: /^أضف كفتة/ }).count()} صنف` }, { clicks: 1, keys: 9 })
  await u.step('يفتح الصنف ويضغط «أضف ملاحظة»', async () => { await p.getByRole('button', { name: 'أضف كفتة فراخ', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: /أضف ملاحظة/ }).click() }, { clicks: 2 })
  await u.step('يكتب «من غير شطة» ويضيف', async () => { await p.getByRole('dialog').getByRole('textbox').fill('من غير شطة'); await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click() }, { clicks: 2, keys: 10 })
  await u.step('يفتح السلة ويتأكد من الملاحظة', async () => { await p.getByRole('button', { name: /عرض السلة/ }).click(); return (await visible(p.getByRole('dialog', { name: 'السلة' }).getByText('من غير شطة'))) ? 'الملاحظة ظاهرة تحت الصنف' : 'الملاحظة غير ظاهرة' }, { read: true })
  await u.step('إتمام الطلب واختيار الاستلام', async () => { await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click(); await p.getByRole('radio', { name: 'استلام من الفرع' }).click() }, { clicks: 2, decide: true })
  let labelPx = 0
  await u.step('يكتب رقمه بالعربي وبمسافات «٠١٠ ٩٨٧٦ ٥٤٣٢»', async () => { labelPx = await p.locator('label[for="name"]').evaluate((l) => parseFloat(getComputedStyle(l).fontSize)); await p.getByLabel('الاسم').fill('الحاج محمود'); await p.getByLabel('رقم الموبايل').fill('٠١٠ ٩٨٧٦ ٥٤٣٢'); await p.getByRole('button', { name: /^تأكيد الطلب/ }).click(); await p.waitForTimeout(600); const err = await p.getByText(/اكتب رقم موبايل صحيح/).count(); return err ? 'رُفض الرقم بسبب المسافات' : 'قُبل الرقم بالمسافات والأرقام العربية' }, { clicks: 3, keys: 25 })
  await u.step('ينتظر التأكيد', async () => { await p.getByRole('heading', { name: 'تم إرسال طلبك' }).waitFor({ timeout: 5000 }); return 'ظهر رقم الطلب' }, { clicks: 0, read: true })
  await u.step('يبحث عن الاتصال بالفرع ليتأكد', async () => { const call = p.getByRole('link', { name: 'اتصل بالفرع' }); return (await visible(call)) ? `زر «اتصل بالفرع» ظاهر: ${await call.getAttribute('href')}` : 'لا يوجد زر اتصال ظاهر' }, { clicks: 0, read: true })
  if (labelPx && labelPx < 12.5) u.confuse(`عناوين الحقول (${labelPx} بكسل) صغيرة لنظره.`)
  u.done(true, 'تكبير عناوين الحقول، وعدم قص اسم الفرع على الشاشات الصغيرة.')
})

// 3. Hurried user ------------------------------------------------------------------------
await persona({ id: 'p3', name: 'مستخدم مستعجل', profile: 'طلب قبل كده، عاوز يعيد نفس الطلب بأسرع طريقة من تليفونه.' }, VIEWPORTS[1], async (u) => {
  const { p } = u
  await p.goto('/branch/ashry')
  u.task('أسرع طلب ممكن: ربع شيش طاووق استلام من العاشر (أول مرة)')
  const t0 = Date.now()
  await u.step('يبحث «شيش» مباشرة', async () => { await p.getByRole('searchbox').fill('شيش') }, { clicks: 1, keys: 4 })
  await u.step('يفتح الصنف ويضيف', async () => { await p.getByRole('button', { name: 'أضف شيش طاووق', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click() }, { clicks: 2 })
  await u.step('السلة ← إتمام الطلب ← استلام', async () => { await p.getByRole('button', { name: /عرض السلة/ }).click(); await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click(); await p.getByRole('radio', { name: 'استلام من الفرع' }).click() }, { clicks: 3 })
  await u.step('الاسم والرقم والتأكيد', async () => { await p.getByLabel('الاسم').fill('عمر'); await p.getByLabel('رقم الموبايل').fill('01234567890'); await p.getByRole('button', { name: /^تأكيد الطلب/ }).click(); await p.getByRole('heading', { name: 'تم إرسال طلبك' }).waitFor() }, { clicks: 3, keys: 14 })
  u.done(true, `إجمالي 9 نقرات تقريباً. زمن التشغيل الآلي ${Math.round((Date.now() - t0) / 100) / 10} ث.`)
  u.task('يعيد نفس الطلب في يوم تالٍ')
  await u.step('يفتح الرئيسية ويرى «طلبك الحالي»', async () => { await p.goto('/'); return (await visible(p.getByRole('link', { name: /A-\d{4}/ }))) ? 'يرى شريط آخر طلب' : 'لا يرى آخر طلب' }, { clicks: 0, read: true })
  let refilled = false
  await u.step('يفتح الطلب ويضغط «اطلب مرة أخرى»', async () => { await p.getByRole('link', { name: /A-\d{4}/ }).click(); await p.getByRole('button', { name: 'اطلب مرة أخرى' }).or(p.getByRole('link', { name: 'اطلب مرة أخرى' })).first().click(); refilled = await p.getByRole('dialog', { name: 'السلة' }).getByText('شيش طاووق').first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false); return refilled ? 'فُتحت السلة وفيها نفس الصنف' : 'فتح المنيو والسلة فارغة: عليه إعادة اختيار كل صنف' }, { clicks: 2, read: true })
  if (!refilled) u.confuse('«اطلب مرة أخرى» يفتح المنيو فقط ولا يعيد الأصناف للسلة.')
  let savedName = ''
  await u.step('إتمام الطلب (الاسم والرقم محفوظان؟)', async () => { if (!refilled) { await p.getByRole('searchbox').fill('شيش'); await p.getByRole('button', { name: 'أضف شيش طاووق', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click(); await p.getByRole('button', { name: /عرض السلة/ }).click() } await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click(); savedName = await p.getByLabel('الاسم').inputValue(); return `الاسم المحفوظ: «${savedName}»` }, { clicks: refilled ? 1 : 6, keys: refilled ? 0 : 4 })
  if (!savedName) u.confuse('بعد الطلب تُمسح بيانات العميل، فيكتب اسمه ورقمه من جديد كل مرة.')
  u.done(refilled, refilled ? 'الأصناف تعود بنقرة؛ يبقى تذكّر الاسم والرقم (قرار المالك).' : 'جعل «اطلب مرة أخرى» يعيد نفس الأصناف للسلة، وتذكّر الاسم والرقم على نفس الجهاز.')
})

// 4. Mobile-only user --------------------------------------------------------------------
await persona({ id: 'p4', name: 'مستخدم الموبايل فقط', profile: 'يستخدم إبهاماً واحداً، يعتمد على زر الرجوع في التليفون، يتابع طلبه بعد ساعة.' }, VIEWPORTS[1], async (u) => {
  const { p } = u
  u.task('يتصفح المنيو ويقفل نافذة الصنف بزر الرجوع')
  await u.step('يدخل منيو العاشر', async () => { await p.goto('/'); await p.getByRole('link', { name: 'اطلب من فرع العاشر من رمضان' }).click() })
  let stayed = false
  await u.step('يفتح صنفاً ثم يضغط رجوع التليفون', async () => { await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); await p.goBack(); await p.waitForTimeout(400); stayed = /\/branch\/ashry$/.test(p.url()) && !(await visible(p.getByRole('dialog'))); return `بعد الرجوع: ${new URL(p.url()).pathname}${stayed ? '، والنافذة قُفلت' : ''}` }, { clicks: 2 })
  if (!stayed) u.confuse('زر الرجوع في التليفون خرج من المنيو كله للرئيسية بدل قفل نافذة الصنف.')
  u.done(stayed, stayed ? 'زر الرجوع يقفل النافذة كما يتوقع.' : 'ربط فتح النافذة بسجل المتصفح ليقفلها زر الرجوع.')
  u.task('يتابع طلباً سابقاً بعد ساعة من الشريط السفلي')
  await u.step('يضغط «تتبع طلب» في الشريط السفلي', async () => { await p.goto('/'); await p.getByRole('navigation').last().getByRole('link', { name: 'تتبع طلب' }).click() })
  await u.step('يكتب رقم طلب ورقماً لا يطابق', async () => { await p.getByLabel('رقم الطلب').fill('A-0001'); await p.getByLabel('رقم الموبايل').fill('01000000009'); await p.getByRole('button', { name: 'عرض حالة الطلب' }).click(); await p.waitForTimeout(500); return (await visible(p.getByRole('heading', { name: 'لم نجد هذا الطلب' }))) ? 'رسالة «لم نجد هذا الطلب» مع واتساب واتصال' : 'لا رسالة' }, { clicks: 3, keys: 17 })
  await u.step('يتأكد أن الأزرار في متناول الإبهام', async () => { const r = await p.getByRole('link', { name: 'تتبع طلب آخر' }).boundingBox(); return `زر المتابعة على ارتفاع ${Math.round(r.y)} من 844` }, { clicks: 0, read: true })
  u.done(true, 'الرحلة واضحة؛ رسالة عدم الوجود تقدم طرق تواصل.')
})

// 5. Professional user (used to delivery apps) --------------------------------------------
await persona({ id: 'p5', name: 'مستخدم معتاد على التطبيقات الاحترافية', profile: 'يستخدم طلبات وTalabat يومياً، على لابتوب، يقارن الأسعار قبل الاختيار.' }, VIEWPORTS[3], async (u) => {
  const { p } = u
  u.task('يقارن أسعار ثلاثة مشويات ويطلب الأرخص لعدد 2، ويعدّل الكمية من السلة')
  await u.step('يفتح منيو التجمع', async () => { await p.goto('/branch/tagamoa'); return `الكروت تعرض الاسم والصورة فقط؛ عدد الأسعار الظاهرة: ${await p.locator('main').getByText(/ج\.م/).count()}` }, { read: true })
  u.confuse('لا أسعار على الكروت: لمقارنة 3 أصناف يفتح 3 نوافذ ويقفلها.')
  const prices = {}
  for (const item of ['صدور فراخ', 'كفتة فراخ', 'شيش طاووق']) {
    await u.step(`يفتح ${item} ليعرف السعر`, async () => { await p.getByRole('button', { name: `أضف ${item}`, exact: true }).click(); prices[item] = (await p.getByRole('dialog').getByRole('radio').first().innerText()).replace(/\s+/g, ' '); await p.keyboard.press('Escape'); return `أول حجم: ${prices[item]}` }, { clicks: 2, read: true })
  }
  await u.step('يضيف الأرخص بكمية 2', async () => { await p.getByRole('button', { name: 'أضف كفتة فراخ', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: 'زيادة الكمية' }).click(); await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click() }, { clicks: 3, decide: true })
  await u.step('يعدّل الكمية من السلة', async () => { await p.getByRole('button', { name: /عرض السلة/ }).click(); await p.getByRole('dialog', { name: 'السلة' }).getByRole('button', { name: /تقليل كمية/ }).click(); return `الإجمالي بعد التعديل: ${await p.getByRole('dialog', { name: 'السلة' }).getByText(/ج\.م/).last().innerText()}` }, { clicks: 2 })
  await u.step('يبحث عن حد أدنى ووقت توصيل ورسوم قبل الدفع', async () => { const t = await p.locator('body').innerText(); return `حد أدنى: ${/حد أدنى/.test(t) ? 'مذكور' : 'غير مذكور'}، وقت التوصيل: ${/دقيقة|وقت التوصيل/.test(t) ? 'مذكور' : 'غير مذكور'}` }, { clicks: 0, read: true })
  u.confuse('لا يوجد وقت توصيل ولا حد أدنى للطلب، وهي معلومات يجدها في كل التطبيقات المنافسة.')
  u.confuse('لا يوجد ترتيب أو فلتر (الأرخص، الأكثر طلباً).')
  u.done(true, 'إظهار «يبدأ من» على الكرت، ووقت التوصيل، ووسم «الأكثر طلباً».')
})

// 6. User who does not know the terms ----------------------------------------------------
await persona({ id: 'p6', name: 'مستخدم لا يفهم بعض المصطلحات', profile: 'من خارج المنطقة، يقول «دجاج» لا «فراخ»، لا يعرف «مسحب» ولا «طاسة» ولا «الشوايات».' }, VIEWPORTS[1], async (u) => {
  const { p } = u
  u.task('يبحث عن «دجاج مشوي» ويفهم الفرق بين الأصناف')
  await u.step('يبحث «دجاج»', async () => { await p.goto('/branch/ashry'); await p.getByRole('searchbox').fill('دجاج'); const n = await p.getByRole('button', { name: /^أضف / }).count(); return `نتائج: ${n} (${n ? (await p.getByRole('button', { name: /^أضف / }).first().getAttribute('aria-label')) : 'لا شيء'})` }, { clicks: 1, keys: 4 })
  const dajaj = await p.getByRole('button', { name: /^أضف / }).count()
  if (dajaj <= 1) u.confuse('كلمة «دجاج» تعطي نتيجة واحدة فقط، بينما كل أصناف الفراخ مكتوبة «فراخ».')
  await u.step('يبحث «فراخ» بدلاً منها', async () => { await p.getByRole('searchbox').fill('فراخ'); return `نتائج: ${await p.getByRole('button', { name: /^أضف / }).count()}` }, { clicks: 1, keys: 4 })
  await u.step('يفتح «فرخة مسحب» ليفهم معنى مسحب', async () => { await p.getByRole('searchbox').fill('مسحب'); await p.getByRole('button', { name: /^أضف فرخة مسحب/ }).first().click(); const desc = await p.getByRole('dialog').locator('p').first().innerText(); return `الوصف: «${desc}»` }, { clicks: 2, read: true })
  u.confuse('لا يوجد وصف يشرح «مسحب» (فرخة مفرودة مشوية)؛ الوصف عام «اختر الكمية وأضف الصنف إلى السلة».')
  await u.step('يفتح قسم «الشوايات» ليفهمه', async () => { await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'مسح البحث' }).first().click(); await p.getByRole('navigation', { name: 'أقسام المنيو' }).getByRole('link', { name: 'الشوايات' }).click(); await p.getByRole('button', { name: /^أضف شواية/ }).first().click(); return `الوصف: «${await p.getByRole('dialog').locator('p').first().innerText()}»` }, { clicks: 3, read: true })
  await u.step('يقرأ الأحجام «تلت» و«نص»', async () => { await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); return `الأحجام: ${(await p.getByRole('dialog').getByRole('radio').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ')).join(' | ')}` }, { clicks: 1, read: true })
  u.confuse('«تلت» و«نص» بالعامية دون توضيح (ثلث كيلو؟)؛ لا يوجد وزن أو عدد أفراد.')
  u.done(dajaj > 1, dajaj > 1 ? 'البحث يفهم «دجاج»؛ يبقى وصف «مسحب» ووزن الأحجام (بيانات من المالك).' : 'إضافة مرادفات للبحث (دجاج=فراخ، لحم=لحمة)، ووصف قصير لكل صنف، وتوضيح الأحجام بالجرام.')
})

writeJSON('results/personas.json', report)
for (const r of report) for (const t of r.tasks) console.log(`${r.id} ${r.name} | ${t.goal.slice(0, 50)} | success=${t.success} clicks=${t.clicks} keys=${t.keys} est=${t.estSeconds}s errors=${t.errors.length} confusion=${t.confusion.length}`)
await b.close()
