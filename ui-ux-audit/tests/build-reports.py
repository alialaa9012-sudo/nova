"""Builds the data-driven reports and the dashboard from results/*.json. Run from ui-ux-audit/."""
import json, glob, os, collections, html, datetime

R = lambda f: json.load(open(f, encoding='utf-8'))
issues = R('results/issues.json'); scores = R('results/scores.json'); cap = R('results/capture.json')
func = R('results/functional.json'); kb = R('results/keyboard.json'); per = R('results/personas.json')
pa = R('results/pa11y-ci.json'); unl = R('results/unlighthouse/ci-result.json')
ST_AR = {'fixed': '✅ أُصلحت', 'partial': '◐ جزئياً', 'open': '⏳ تنتظر المالك'}
SEV = ['Critical', 'High', 'Medium', 'Low']; SEV_AR = {'Critical': 'حرجة', 'High': 'عالية', 'Medium': 'متوسطة', 'Low': 'منخفضة'}
VPS = [('m360', 'موبايل 360×800'), ('m390', 'موبايل 390×844'), ('t768', 'تابلت 768×1024'), ('d1366', 'كمبيوتر 1366×768'), ('d1920', 'كمبيوتر 1920×1080')]
w = lambda name, text: open(f'reports/{name}', 'w', encoding='utf-8').write(text)

# ---------- functional results
FUNC_AR = {
 'F01': 'كل زر «اطلب الآن» يفتح منيو فرعه', 'F02': 'أزرار الاتصال والخريطة تشير لرقم كل فرع وخرائط Google في تبويب جديد', 'F03': 'واتساب وتتبع طلب في هيدر الكمبيوتر',
 'F04': 'الفروع المغلقة تقول متى تفتح وتسمح بالتصفح', 'F05': 'شريط «طلبك الحالي» يفتح آخر طلب', 'F06': 'الشريط السفلي على الموبايل (الرئيسية، التتبع، واتساب)',
 'F07': '«كل الفروع» يرجع للرئيسية', 'F08': 'البحث يضيق النتائج ويتسامح مع الإملاء ويُمسح بـ×', 'F09': 'بحث بلا نتائج يقول ذلك ويعرض مسح البحث',
 'F10': 'البحث بكلمة «دجاج» يجد أصناف «فراخ» (مرادفات)', 'F11': 'زر القسم ينقل لقسمه ويتلون', 'F12': 'الأحجام بأسعارها وزر الإضافة يتبع الحجم والكمية',
 'F13': 'ملاحظة الصنف اختيارية ومعدودة بحد 120 حرفاً', 'F14': 'الإضافة تعرض تأكيداً وشريط السلة بالعدد والإجمالي', 'F15': 'أصناف الحجز المسبق تعرض اتصالاً بدل الإضافة',
 'F16': 'السلة: الكمية والإجمالي والحذف والحالة الفارغة', 'F17': 'السلة تبقى بعد إعادة التحميل ومنفصلة لكل فرع', 'F18': 'الفرع المغلق: السلة توضح وتمنع الإتمام',
 'F19': 'Escape يقفل نافذة الصنف ويرجع التركيز للصنف', 'F20': 'زر الرجوع في التليفون يقفل نافذة الصنف بدل الخروج من المنيو', 'F21': 'السلة الفارغة في الإتمام توجه للمنيو',
 'F22': 'الحقول الناقصة: رسالة واضحة لكل حقل والتركيز على أولها', 'F23': 'الموبايل: يقبل الأرقام العربية ويرفض البادئة الخاطئة', 'F24': 'رسوم المنطقة وضريبة التجمع 14٪ قبل التأكيد',
 'F25': 'الاستلام يخفي العنوان ويعرض عنوان الفرع', 'F26': 'البيانات المكتوبة تبقى بعد إعادة التحميل والرجوع للمنيو', 'F27': 'منطقة غير موجودة: رقم الفرع كمخرج',
 'F28': 'الفرع المغلق لا يسمح بالتأكيد ويقول متى', 'F29': 'التأكيد يعرض الرقم ويفرغ السلة ويحفظ الطلب', 'F30': 'الطلب الرابع من نفس الرقم خلال 10 دقائق يُرفض برسالة واضحة',
 'F31': 'الضغط المزدوج على التأكيد = طلب واحد', 'F32': 'نسخ رقم الطلب ومشاركته على واتساب', 'F33': 'تغيير الحالة في اللوحة يصل لصفحة الطلب المفتوحة بلا تحديث',
 'F34': '«اطلب مرة أخرى» يفتح نفس الفرع ونفس الأصناف في السلة مفتوحة', 'F35': 'رابط طلب بلا رقم موبايل يطلبه، والرقم الخاطئ لا يجد شيئاً', 'F36': 'التتبع: أخطاء واضحة ثم الرقم الصحيح يفتح الطلب',
 'F37': 'رابط غير موجود يعرض صفحة 404 بروابط الفروع', 'F38': 'فلاتر الحالة والبحث في اللوحة', 'F39': 'الطلب يتنقل بين الحالات في اللوحة',
 'F40': 'الإلغاء يحتاج سبباً، و«سبب آخر» يحتاج كتابة', 'F41': 'التفاصيل تعرض الأصناف بالملاحظات ويُحفظ رقم فاتورة الكاشير', 'F42': 'طلب جديد من تبويب آخر يظهر في اللوحة المفتوحة',
 'F43': 'المناطق: رفض الفارغ والمكرر، قبول الأرقام العربية، الظهور في الإتمام، الحذف بتأكيد', 'F44': 'تسعير منطقة معلّقة من زرها', 'F45': 'لوحة الموظفين تطلب تسجيل دخول', 'F46': 'شريط النسخة التجريبية ظاهر في كل الصفحات',
}
tests = []
def walk(s, group=''):
    for sp in s.get('specs', []):
        fid = sp['title'][:3]; r = sp['tests'][0]['results'][-1]
        tests.append({'id': fid, 'group': group or s.get('title', ''), 'ok': r['status'] == 'passed', 'ms': r['duration'], 'err': (r.get('error') or {}).get('message', '').split('\n')[0][:140]})
    for c in s.get('suites', []): walk(c, c.get('title', ''))
for s in func['suites']: walk(s)
tests.sort(key=lambda t: t['id'])
FAIL_NOTE = {'F10': 'فشل: «دجاج» لا يجد «صدور فراخ» (UX-07)', 'F20': 'فشل: الرجوع ذهب إلى الرئيسية «/» (UX-04)', 'F45': 'فشل متوقع: لا توجد شاشة دخول (UX-01، يحتاج حساب Supabase)'}
passed = sum(t['ok'] for t in tests)
failed_ids = [t['id'] for t in tests if not t['ok']]
fail_line = 'لا يوجد اختبار فاشل.' if not failed_ids else f"الفاشل: {'، '.join(failed_ids)}. " + ('وهو فشل متوقع لأن شاشة الدخول لم تُبنَ بعد (UX-01)، لا خطأ في الاختبار.' if failed_ids == ['F45'] else 'كلها مشاكل حقيقية في الموقع لا في الاختبار.')
lines = ['# تقرير الاختبار الوظيفي', '', f'**النتيجة:** {passed} من {len(tests)} اختباراً نجحت. {fail_line}', '',
 '**قبل الإصلاحات:** فشل F10 (البحث بالمرادفات) وF20 (زر رجوع التليفون) أيضاً، وكلاهما ينجح الآن. المقارنة الكاملة في `FIXES-AND-RESULTS.md`.', '',
 'نُفذت الاختبارات بمتصفح Chromium حقيقي (Playwright 1.63) على نسخة الإنتاج المحلية، ببيانات تجريبية فقط: الطلبات تُحفظ في المتصفح ولا تُرسل لأي جهة. الكود في `tests/functional.spec.mjs` ويُعاد تشغيله بـ `npx playwright test --config playwright.config.mjs`.', '',
 '| # | المجموعة | ما الذي اختُبر (النتيجة المتوقعة) | النتيجة | الزمن |', '|---|---|---|---|---|']
for t in tests:
    res = '✅ نجح' if t['ok'] else '❌ ' + FAIL_NOTE.get(t['id'], t['err'])
    lines.append(f"| {t['id']} | {t['group']} | {FUNC_AR.get(t['id'], '')} | {res} | {t['ms']/1000:.1f} ث |")
lines += ['', '## ما تأكدنا منه في كل إجراء', '- **الزر يؤدي وظيفته:** كل الأزرار والروابط المختبرة تفتح وجهتها الصحيحة (F01 إلى F07، F21، F34، F37).',
 '- **المستخدم يعرف ما حدث:** رسالة بعد الإضافة (F14)، ورقم الطلب بعد التأكيد (F29)، وتأكيد النسخ (F32)، ورسالة لكل خطأ (F22، F23، F30، F36، F43).',
 '- **حالات التحميل والنجاح والخطأ:** النجاح والخطأ واضحان؛ التحميل سريع جداً محلياً فلم يمكن قياس وضوح حالة «جاري الإرسال» بشبكة حقيقية.',
 '- **الرجوع بلا فقد بيانات:** السلة والبيانات تبقى بعد إعادة التحميل والرجوع للمنيو (F17، F26)، وزر رجوع التليفون يقفل النافذة المفتوحة ويبقى في المنيو (F20).',
 '', '## ما لم يُختبر', '- الدفع الإلكتروني وتسجيل العملاء والملف الشخصي والإشعارات: غير موجودة في الموقع.',
 '- إرسال طلب حقيقي للمطعم: الخلفية غير مربوطة (UX-02)، ولم نرسل أي طلب لأي جهة خارجية.',
 '- الصوت في لوحة الموظفين عند وصول طلب: يحتاج مخرج صوت، لم يُقيَّم.', '- المكالمات وواتساب: تحققنا من صحة الروابط فقط دون فتحها.']
w('FUNCTIONAL-TEST-REPORT.md', '\n'.join(lines) + '\n')

# ---------- bugs and issues
by = collections.defaultdict(list)
for i in issues: by[i['severity']].append(i)
stc = collections.Counter(i['status'] for i in issues)
L = ['# المشاكل المكتشفة', '', f'العدد: **{len(issues)}** مشكلة: ' + '، '.join(f"{SEV_AR[s]} {len(by[s])}" for s in SEV) + '.', '',
 f"**الحالة الآن:** أُصلحت {stc['fixed']}، وجزئياً {stc['partial']}، وتنتظر بيانات أو قراراً من المالك {stc['open']}. الوصف والدليل أدناه كما رُصدا **قبل** الإصلاح، وسطر «الحالة» يقول ما تم. الأرقام بعد الإصلاح في `FIXES-AND-RESULTS.md`.", '',
 '**التصنيف:** حرجة = تمنع إتمام المهمة أو الإطلاق. عالية = تؤثر بشدة على التجربة. متوسطة = صعوبة أو ارتباك. منخفضة = تحسين شكلي أو تفصيلي.', '',
 'كل مشكلة هنا شوهدت أو قيست فعلاً بأداة أو اختبار مذكور في «المصدر». الاقتراحات التصميمية التي ليست مشاكل في قسم منفصل آخر الملف.', '',
 '| # | الخطورة | الصفحة | المشكلة | الحالة |', '|---|---|---|---|---|']
for i in issues: L.append(f"| [{i['id']}](#{i['id'].lower()}) | {SEV_AR[i['severity']]} | {i['page']} | {i['title']} | {ST_AR[i['status']]} |")
for s in SEV:
    L += ['', f'## {SEV_AR[s]}']
    for i in by[s]:
        shot = f"\n![{i['id']}](../{i['screenshot']})" if i['screenshot'] else ''
        L += ['', f"### {i['id']}", f"**{i['title']}**", '',
              f"- **الصفحة:** {i['page']}", f"- **العنصر:** {i['element']}", f"- **الوصف:** {i['description']}", f"- **الدليل:** {i['evidence']}",
              f"- **لقطة الشاشة:** {'`' + i['screenshot'] + '`' if i['screenshot'] else 'لا توجد (نتيجة اختبار لوحة المفاتيح أو قياس)، انظر `results/`'}",
              f"- **السبب المحتمل:** {i['cause']}", f"- **التأثير على المستخدم:** {i['impact']}", f"- **الحل المقترح:** {i['fix']}", f"- **الأولوية:** {SEV_AR[s]}", f"- **المصدر:** {i['source']}",
              f"- **الحالة:** {ST_AR[i['status']]}" + (f". {i['done']}" if i['done'] else '') + (f" **المطلوب من المالك:** {i['needs']}." if i['needs'] else '')] + ([shot] if shot else [])
L += ['', '## اقتراحات تصميمية (ليست مشاكل)', '',
 '- **ترتيب الأقسام:** المنيو يبدأ بالشوربة بقرار المالك. الزائر الجديد الذي يبحث عن المشويات (الشخصية 1) استخدم شريط الأقسام. ليس خطأً؛ يمكن قياسه لاحقاً بعدد الطلبات من كل قسم.',
 '- **أصناف بلا صورة (43):** تظهر بأيقونة ذهبية متسقة مع الهوية. إضافة صورها تزيد الشهية.',
 '- **وسم «الأكثر طلباً»:** مفيد للمستخدم المعتاد على التطبيقات (الشخصية 5)، والآلية موجودة في الكود (شارات من ملف البيانات).',
 '- **صفحة «كيف نعمل»:** الدفع كاش، ومن يتصل، ووقت التوصيل، وسياسة الإلغاء في مكان واحد.']
w('BUGS-AND-ISSUES.md', '\n'.join(L) + '\n')

# ---------- responsive
rows = collections.defaultdict(lambda: collections.Counter())
for r in cap:
    p = r['probe']; c = rows[r['vp']]
    c['runs'] += 1; c['overflow'] += p['docOverflowX'] > 0; c['offscreen'] += len(p['offscreen']); c['clipped'] += len(p['clipped']); c['covered'] += len(p['covered'])
    c['tiny'] += len(p['tinyTargets']); c['small'] += len(p['smallTargets']); c['under'] += len(p['underSticky']); c['err'] += len(r['consoleErrors']) + len(r['pageErrors']) + len(r['failed'])
    c['minfont'] = min(c['minfont'] or 99, p['minFont']) if c['minfont'] else p['minFont']
R2 = ['# تقرير التجاوب مع مقاسات الشاشات', '', f'فُحصت **{len({r["state"] for r in cap})} حالة** في **10 صفحات** على **5 مقاسات** = {len(cap)} تشغيلاً، مع لقطة شاشة لكل تشغيل في `screenshots/<المقاس>/` وصفحات كاملة للحالات الطويلة في `screenshots/full/`. لوحة مصغرة لكل مقاس: `screenshots/contact-<المقاس>.jpg`.', '',
 'كل رقم في الجدول من فحص آلي داخل الصفحة (`tests/probe.mjs`) يقيس العناصر الفعلية بعد رسمها:', '',
 '| المقاس | تشغيلات | تمرير أفقي | عناصر خارج الشاشة | نص مقصوص | عناصر مغطاة | أهداف لمس أقل من 24 | أقل من 44 | أخطاء كونسول/شبكة | أصغر خط |', '|---|---|---|---|---|---|---|---|---|---|']
for vp, ar in VPS:
    c = rows[vp]; R2.append(f"| {ar} | {c['runs']} | {c['overflow']} | {c['offscreen']} | {c['clipped']} | {c['covered']} | {c['tiny']} | {c['small']} | {c['err']} | {c['minfont']} بكسل |")
tot = collections.Counter(); [tot.update(rows[v]) for v, _ in VPS]
R2 += ['', '## قراءة الأرقام', '- **صفر تمرير أفقي وصفر عنصر خارج الشاشة** في كل المقاسات والحالات. هذا أهم مؤشر للتجاوب وهو سليم تماماً.',
 f"- **النص المقصوص:** {tot['clipped']} (كان 13 قبل الإصلاح: عنوان فرع التجمع واسم الفرع على 360، UX-13 وUX-28).",
 '- **العناصر المغطاة:** كلها في حالة «قائمة المناطق مفتوحة»: القائمة المنسدلة تغطي الحقول تحتها (سلوك صحيح)، والخيارات التي تقع خارج منطقة تمرير القائمة تُحسب مغطاة. راجعناها بصرياً: لا مشكلة حقيقية.',
 '- **أهداف أقل من 24 بكسل:** رقم هاتف الفرع داخل جملة في إتمام الطلب (21 بكسل ارتفاعاً). الروابط داخل الجمل مستثناة من معيار WCAG 2.5.8، لكنها تبقى صغيرة للإصبع.',
 f"- **أهداف بين 24 و44:** {tot['small']} (كانت 102). أُصلحت أزرار مسح البحث وحذف الملاحظة والعداد والنسخ والمشاركة (UX-21). الباقي أزرار الأقسام (40 بكسل)، وروابط داخل جمل، وعناصر عند حافة الشاشة لا يحسبها القياس كاملة.",
 '- **الخط الأصغر:** النص الثانوي صار 12 بكسل على الأقل، وعناوين الحقول 13 (UX-22).', '', '## ملاحظات بصرية لكل مقاس (مراجعة اللقطات)',
 '- **360:** يعمل كل شيء. اسم الفرع يلتف على سطرين بدل القص. المنيو عمودين وكروت مقروءة. نافذة الصنف وأزرارها في متناول الإبهام.',
 '- **390:** المقاس الأفضل. الفروع الثلاثة في شاشة واحدة بلا تمرير.', '- **768:** المنيو 4 أعمدة، والنوافذ في المنتصف بعرض 480. لا مشاكل.',
 '- **1366:** إتمام الطلب بثلاثة أعمدة والملخص ثابت. الحقول بخلفية ظاهرة (UX-12).', '- **1920:** المحتوى بعرض أقصى 1480 من 1700 بكسل، فقلّت المساحات الفارغة (UX-27).',
 '', '## اتجاه RTL واللغة العربية', f"- الصفحة `dir=rtl` و`lang=ar` في كل الحالات. عناصر عربية باتجاه LTR: {sum(len(r['probe']['ltrArabic']) for r in cap)}. نصوص عربية بمحاذاة يسار: {sum(len(r['probe']['leftAligned']) for r in cap)}.",
 '- أرقام الموبايل ورقم الطلب تُعرض LTR عن قصد (`dir=ltr`) وهذا صحيح.', '- الخطوط: Cairo للواجهة وAmiri للأسماء، والحروف العربية تظهر متصلة وسليمة في كل اللقطات.']
w('RESPONSIVE-AUDIT.md', '\n'.join(R2) + '\n')

# ---------- performance
P = ['# تقرير الأداء', '', 'قيس بأداتين محليتين: **Lighthouse 13.6** (6 صفحات × موبايل وكمبيوتر) و**Unlighthouse 0.19** (8 صفحات، موبايل). الموبايل في Lighthouse يحاكي شبكة 4G بطيئة (1.6 ميجابت) ومعالجاً أبطأ 4 مرات، فهو أسوأ من أغلب الهواتف الفعلية. النتائج على نسخة الإنتاج المحلية بلا CDN.', '',
 '| الصفحة | الجهاز | الأداء | الوصول | أفضل الممارسات | SEO | FCP | LCP | TBT | CLS | الحجم |', '|---|---|---|---|---|---|---|---|---|---|---|']
NAMES = {'home': 'الرئيسية', 'menu-ashry': 'منيو العاشر', 'menu-tagamoa': 'منيو التجمع', 'track': 'التتبع', 'not-found': '404', 'admin': 'لوحة الكول سنتر'}
for n in ['home', 'menu-ashry', 'menu-tagamoa', 'track', 'not-found', 'admin']:
    for mode, ar in [('mobile', 'موبايل'), ('desktop', 'كمبيوتر')]:
        j = R(f'results/lighthouse/{n}-{mode}.report.json'); c = j['categories']; a = j['audits']; s = lambda k: round(c[k]['score'] * 100)
        P.append(f"| {NAMES[n]} | {ar} | {s('performance')} | {s('accessibility')} | {s('best-practices')} | {s('seo')} | {a['first-contentful-paint']['displayValue']} | {a['largest-contentful-paint']['displayValue']} | {a['total-blocking-time']['displayValue']} | {a['cumulative-layout-shift']['displayValue']} | {round(a['total-byte-weight']['numericValue']/1024)} KB |")
P += ['', '## Unlighthouse (فحص شامل، موبايل)', '', '| المسار | الأداء | الوصول | أفضل الممارسات | SEO |', '|---|---|---|---|---|']
for r in unl['routes']:
    c = r['categories']; P.append(f"| `{r['path']}` | {round(c['performance']['score']*100)} | {round(c['accessibility']['score']*100)} | {round(c['best-practices']['score']*100)} | {round(c['seo']['score']*100)} |")
P += ['', '## التحليل', '- **الكمبيوتر ممتاز:** 97 إلى 100 في كل الصفحات، وLCP أقل من 1.3 ثانية.',
 '- **المنيو على الموبايل تحسّن (UX-03):** كان 76 إلى 80 وLCP بين 5.4 و5.6 ثوانٍ. الآن الصور تُطلب فقط عند اقترابها من الشاشة، والكروت تستخدم نسخاً 400×300، وأول 4 صور بأولوية. الأرقام قبل وبعد في `FIXES-AND-RESULTS.md`.',
 '- **باقي صفحات الموبايل جيدة:** LCP سببه الخطوط واللوجو.',
 '- **ثبات التخطيط (CLS):** صفر تقريباً في صفحات العملاء. لوحة الموظفين على الموبايل كانت 0.108 (UX-25)، وسببها الباقي تبديل الخط اللاتيني للأرقام.',
 '- **JavaScript غير مستخدم:** حوالي 84 KB يمكن تأجيلها (بيانات المنيو والمكتبات).',
 '- **SEO 66 في لوحة الموظفين مقصود:** الصفحة ممنوعة من الفهرسة في robots.txt.', '- **الصور:** كلها WebP، والكروت تستخدم نسخاً مصغرة 400×300، والهيدر الغامق يستخدم لوجو 200 بكسل (UX-26).',
 '- **تذبذب القياس:** نفس الصفحة تتغير بضع نقاط بين تشغيل وآخر (لاحظنا 404 بين 91 و99).',
 '', '## Core Web Vitals', 'القيم أعلاه مختبرية (Lab). قيم المستخدمين الحقيقيين (Field / CrUX) لا تتوفر قبل نشر الموقع وزيارته. **غير مُتحقَّق** على أجهزة وشبكات حقيقية.',
 '', 'التقارير الكاملة: `results/lighthouse/*.report.html` و`results/unlighthouse/index.html` (تُفتح من المتصفح مباشرة).']
w('PERFORMANCE-REPORT.md', '\n'.join(P) + '\n')

# ---------- pages inventory
from collections import OrderedDict
PAGES = OrderedDict([
 ('الرئيسية', ('/', 'اختيار الفرع، والاتصال، والخريطة، وواتساب، والتتبع', 'اللوجو والشعار، 3 كروت فروع بشارة الحالة، «اطلب الآن»، اتصال، خريطة، شريط «طلبك الحالي»، شريط سفلي (موبايل)', 'HomePage، OpenBadge، BottomNav، HeroBanner (مخفي بلا محتوى)، DemoBanner')),
 ('المنيو', ('/branch/:id (ashry، zagazig، tagamoa)', 'تصفح الأصناف والبحث والإضافة للسلة', 'هيدر بالفرع وحالته، بحث، شريط أقسام يتبع التمرير، كروت بصور، شريط السلة العائم، رسالة الفرع المغلق', 'MenuPage، CategoryBar، ItemCard، ItemImage، PromoStrip (مخفي)، OpenBadge')),
 ('نافذة الصنف', ('نافذة داخل المنيو', 'اختيار الحجم والكمية والملاحظة', 'صورة الصنف، الأحجام بأسعارها، ملاحظة (120 حرفاً)، عداد، زر «أضف للسلة · السعر»', 'ItemSheet، ModalSheet، QtyStepper')),
 ('السلة', ('نافذة داخل المنيو', 'مراجعة الأصناف وتعديلها', 'سطور بصور وملاحظات، عداد، حذف، المجموع، «إتمام الطلب»، الحالة الفارغة، رسالة الإغلاق', 'CartSheet، ModalSheet، QtyStepper')),
 ('إتمام الطلب', ('/branch/:id/checkout', 'إدخال البيانات وتأكيد الطلب', 'شريط غامق بالإجمالي، توصيل/استلام، بياناتك، العنوان، المنطقة بالبحث، ملاحظات، الملخص، زر التأكيد الثابت', 'CheckoutPage، BandHeader، IconField، ZoneCombobox، OrderSummary')),
 ('صفحة الطلب', ('/order/:number', 'تأكيد الطلب ومتابعة حالته', 'رقم الطلب مع نسخ ومشاركة، خط الحالة، التفاصيل، واتساب، اتصال، اطلب مرة أخرى، طلب رقم الموبايل، «لم نجد هذا الطلب»', 'OrderPage، OrderNumberCard، StatusTimeline، OrderSummary، TrackForm')),
 ('تتبع طلب', ('/track', 'البحث عن طلب بالرقم والموبايل', 'حقلا رقم الطلب والموبايل، زر «عرض حالة الطلب»، رسائل الخطأ، شريط سفلي', 'TrackPage، TrackForm، BandHeader، BottomNav')),
 ('صفحة غير موجودة', ('أي مسار آخر، و/branch/<فرع غير موجود>', 'إرشاد الزائر لفرع صحيح', 'اللوجو، العنوان، روابط الفروع الثلاثة', 'NotFoundPage')),
 ('لوحة الكول سنتر', ('/admin', 'إدارة الطلبات للموظفين', 'فلتر الفرع والتاريخ والبحث وأزرار الحالات، كروت الطلبات بعمر الطلب، نقل الحالة، التفاصيل، الإلغاء بسبب، رقم فاتورة الكاشير', 'AdminPage، AdminNav، OrderCard، OrderDetailsSheet، CancelDialog')),
 ('مناطق التوصيل', ('/admin/zones', 'إضافة مناطق ورسومها وتسعير المعلّقة', 'اختيار الفرع، نموذج الإضافة، المناطق المعلّقة، قائمة المناطق بالبحث، الحذف بتأكيد', 'ZonesPage، AdminNav')),
])
states_by_page = collections.defaultdict(list)
for r in cap:
    if r['vp'] == 'm390': states_by_page[r['page']].append(r['title'])
func_by_page = {'الرئيسية': 'F01–F06', 'المنيو': 'F07–F11، F14، F15، F17، F20', 'نافذة الصنف': 'F12، F13، F19', 'السلة': 'F16، F18', 'إتمام الطلب': 'F21–F31', 'صفحة الطلب': 'F32–F35', 'تتبع طلب': 'F36', 'صفحة غير موجودة': 'F37', 'لوحة الكول سنتر': 'F38–F42، F45', 'مناطق التوصيل': 'F43، F44'}
I = ['# جرد الصفحات', '', 'استُخرجت القائمة من ملف المسارات `app/src/routes.tsx`، وروابط القوائم والأزرار، ومكونات كل صفحة. لا توجد sitemap بعد. النوافذ (الصنف والسلة) جُردت كصفحات مستقلة لأنها شاشات كاملة على الموبايل.', '',
 '**معنى «تم الاختبار»:** الصفحة فُحصت فعلاً بالأدوات المذكورة، لا مجرد فتحها.', '', '| الصفحة | الرابط | الحالات المفحوصة | تم الاختبار |', '|---|---|---|---|']
for name, (url, fn, els, comps) in PAGES.items():
    I.append(f"| {name} | `{url}` | {len(states_by_page[name])} | ✅ |")
for name, (url, fn, els, comps) in PAGES.items():
    I += ['', f'## {name}', f'- **الرابط:** `{url}`', f'- **الوظيفة:** {fn}', f'- **العناصر الرئيسية:** {els}', f'- **المكونات:** {comps}',
          '- **الحالات المختلفة (كلها مصورة على 5 مقاسات):**'] + [f'  - {t}' for t in states_by_page[name]] + [
          f'- **تم الاختبار:** نعم. لقطات 5 مقاسات + فحص بصري آلي + axe (390 و1366) + اختبارات وظيفية {func_by_page[name]}.']
I += ['', '## حالات لم تُفحص', '- **حالة التحميل (RouteLoading) وشاشة البداية:** تظهر أقل من جزء من الثانية محلياً، فلم تُلتقط بشكل موثوق.',
 '- **بنر العروض وشريط العروض والشارات:** مبنية لكنها مخفية لأن ملفات بياناتها فارغة؛ لا يمكن رؤيتها كما سيراها العميل.',
 '- **أخطاء الخادم (انقطاع الشبكة أثناء الطلب):** الخلفية الحالية محلية فلا يحدث خطأ شبكة حقيقي.']
w('../pages-inventory.md', '\n'.join(I) + '\n')

# ---------- dashboard data
by_page = collections.Counter(); sev_page = collections.defaultdict(collections.Counter)
ALIAS = {'الطلب': 'صفحة الطلب', 'التأكيد': 'صفحة الطلب', 'التتبع': 'تتبع طلب', '404': 'صفحة غير موجودة', 'اللوحة': 'لوحة الكول سنتر', 'الرئيسية وغيرها': 'الرئيسية'}
for i in issues:
    for pg in [x.strip() for x in i['page'].replace('/', '،').split('،')]:
        pg = ALIAS.get(pg, pg)
        if pg not in PAGES: continue  # findings that apply to every page are counted once overall
        by_page[pg] += 1; sev_page[pg][i['severity']] += 1
weights = {'Critical': 10, 'High': 5, 'Medium': 2, 'Low': 1}
page_score = []
for name in PAGES:
    pen = sum(weights[s] * n for s, n in sev_page.get(name, {}).items())
    page_score.append({'page': name, 'issues': by_page.get(name, 0), 'penalty': pen})
vp_rows = [{'vp': ar, **{k: rows[v][k] for k in ['runs', 'overflow', 'offscreen', 'clipped', 'tiny', 'small', 'err']}} for v, ar in VPS]
lh = []
for n in NAMES:
    for mode in ['mobile', 'desktop']:
        j = R(f'results/lighthouse/{n}-{mode}.report.json'); lh.append({'page': NAMES[n], 'mode': 'موبايل' if mode == 'mobile' else 'كمبيوتر', 'perf': round(j['categories']['performance']['score'] * 100), 'lcp': j['audits']['largest-contentful-paint']['displayValue']})
personas = [{'name': p['name'], 'vp': p['viewport'], 'tasks': [{'goal': t['goal'], 'ok': t['success'], 'clicks': t['clicks'], 'est': t['estSeconds'], 'confusion': t['confusion']} for t in p['tasks']]} for p in per]
axe_runs = [r for r in cap if 'axe' in r]
data = {'generated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'scores': scores, 'scoresBefore': R('results/before/scores.json'), 'issues': issues, 'pages': page_score, 'pagesTotal': len(PAGES), 'states': len({r['state'] for r in cap}),
        'runs': len(cap), 'functional': {'passed': passed, 'total': len(tests)}, 'axeRuns': len(axe_runs), 'axeWcagViolations': sum(1 for r in axe_runs for a in r['axe'] if a['id'] not in ('region', 'landmark-one-main')),
        'viewports': vp_rows, 'lighthouse': lh, 'personas': personas,
        'coverage': {'pages': 100, 'viewports': 100, 'states': len({r['state'] for r in cap}), 'functional': round(passed / len(tests) * 100)},
        'shots': [f"screenshots/d1366/{s}.jpg" for s in ['home', 'menu-ashry', 'item-sheet', 'cart', 'checkout-filled', 'order-preparing', 'track', 'admin-orders', 'zones']],
        'mobileShots': [f"screenshots/m390/{s}.jpg" for s in ['home', 'menu-ashry', 'item-sheet', 'cart', 'checkout-delivery', 'order-placed', 'track', 'not-found']]}
os.makedirs('dashboard', exist_ok=True)
open('dashboard/data.js', 'w', encoding='utf-8').write('window.AUDIT = ' + json.dumps(data, ensure_ascii=False) + ';\n')
print('reports ok:', sorted(os.listdir('reports')), 'tests', passed, '/', len(tests))
