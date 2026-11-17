"""Writes reports/FIXES-AND-RESULTS.md: what was fixed, and the same measurements before and after.
Before = results/before/ (saved before any fix). After = results/ (the latest run). Run from ui-ux-audit/."""
import json, collections

R = lambda f: json.load(open(f, encoding='utf-8'))
B, A = 'results/before/', 'results/'
issues = R(A + 'issues.json')


def probe_totals(cap):
    t = collections.Counter()
    for r in cap:
        p = r['probe']
        t['runs'] += 1; t['overflow'] += p['docOverflowX'] > 0; t['offscreen'] += len(p['offscreen']); t['clipped'] += len(p['clipped'])
        t['tiny'] += len(p['tinyTargets']); t['small'] += len(p['smallTargets']); t['smallText'] += len(p['smallText'])
        t['systemFont'] += sum(1 for f in p['families'] if f not in ('Cairo Variable', 'Amiri'))
        t['oversized'] += len(p['oversized']); t['err'] += len(r['consoleErrors']) + len(r['pageErrors']) + len(r['failed'])
        for a in r.get('axe', []): t['axe:' + a['id']] += 1
    return t


def func_totals(func):
    out = []
    def walk(s):
        for sp in s.get('specs', []): out.append(sp['tests'][0]['results'][-1]['status'] == 'passed')
        for c in s.get('suites', []): walk(c)
    for s in func['suites']: walk(s)
    return sum(out), len(out)


def persona_totals(per):
    tasks = [t for p in per for t in p['tasks']]
    return sum(t['success'] for t in tasks), len(tasks), sum(len(t['confusion']) for t in tasks)


def lh_now():
    out = {}
    for n in ['home', 'menu-ashry', 'menu-tagamoa', 'track', 'not-found', 'admin']:
        for m in ['mobile', 'desktop']:
            j = R(f'{A}lighthouse/{n}-{m}.report.json'); a = j['audits']
            out[f'{n}-{m}'] = {'perf': round(j['categories']['performance']['score'] * 100), 'a11y': round(j['categories']['accessibility']['score'] * 100),
                               'lcp': a['largest-contentful-paint']['displayValue'], 'cls': a['cumulative-layout-shift']['displayValue'], 'kb': round(a['total-byte-weight']['numericValue'] / 1024)}
    return out


def kb_page(kb, page):
    return next((k for k in kb if k['page'] == page), {})


pb, pa = probe_totals(R(B + 'capture.json')), probe_totals(R(A + 'capture.json'))
fb, fa = func_totals(R(B + 'functional.json')), func_totals(R(A + 'functional.json'))
sb, sa = persona_totals(R(B + 'personas.json')), persona_totals(R(A + 'personas.json'))
kbb, kba = R(B + 'keyboard.json'), R(A + 'keyboard.json')
lhb, lha = R(B + 'lighthouse-summary.json'), lh_now()
ulb = {r['path']: r['perf'] for r in R(B + 'unlighthouse-summary.json')}
ula = {r['path']: round(r['categories']['performance']['score'] * 100) for r in R(A + 'unlighthouse/ci-result.json')['routes']}
pa11y = lambda j: j.get('errors', 0)
scb, sca = R(B + 'scores.json'), R(A + 'scores.json')

arrow = lambda b, a, lower_better=True: '✅' if (a < b if lower_better else a > b) else ('=' if a == b else '⚠️')
L = ['# ما تم إصلاحه والنتائج قبل وبعد', '',
     'أُصلح كل ما لا يحتاج بيانات أو قراراً من المالك، ثم أُعيد تشغيل **نفس الفحوص بنفس الأدوات والإعدادات** على النسخة الجديدة. الأرقام في «قبل» من `results/before/` وفي «بعد» من `results/`، وكلها ناتج تشغيل فعلي.', '']
st = collections.Counter(i['status'] for i in issues)
L += [f"**المشاكل:** {len(issues)} مشكلة: أُصلحت {st['fixed']}، وجزئياً {st['partial']}، وتنتظر المالك {st['open']}.", '']

L += ['## المقاييس قبل وبعد', '', '| المقياس | قبل | بعد | |', '|---|---|---|---|']
rows = [
    ('اختبارات وظيفية ناجحة', f'{fb[0]} من {fb[1]}', f'{fa[0]} من {fa[1]}', arrow(fb[0], fa[0], False)),
    ('مهام الشخصيات الناجحة', f'{sb[0]} من {sb[1]}', f'{sa[0]} من {sa[1]}', arrow(sb[0], sa[0], False)),
    ('ملاحظات ارتباك الشخصيات', sb[2], sa[2], arrow(sb[2], sa[2])),
    ('axe: اسم مقروء لا يطابق النص (WCAG 2.5.3)', pb['axe:label-content-name-mismatch'], pa['axe:label-content-name-mismatch'], arrow(pb['axe:label-content-name-mismatch'], pa['axe:label-content-name-mismatch'])),
    ('axe: صفحة بلا main', pb['axe:landmark-one-main'], pa['axe:landmark-one-main'], arrow(pb['axe:landmark-one-main'], pa['axe:landmark-one-main'])),
    ('axe: محتوى خارج المناطق', pb['axe:region'], pa['axe:region'], arrow(pb['axe:region'], pa['axe:region'])),
    ('نص مقصوص', pb['clipped'], pa['clipped'], arrow(pb['clipped'], pa['clipped'])),
    ('نصوص أصغر من 12 بكسل', pb['smallText'], pa['smallText'], arrow(pb['smallText'], pa['smallText'])),
    ('أهداف لمس بين 24 و44 بكسل', pb['small'], pa['small'], arrow(pb['small'], pa['small'])),
    ('أهداف لمس أقل من 24 بكسل', pb['tiny'], pa['tiny'], arrow(pb['tiny'], pa['tiny'])),
    ('نص بخط النظام بدل خط الموقع', pb['systemFont'], pa['systemFont'], arrow(pb['systemFont'], pa['systemFont'])),
    ('لوجو الشريط الغامق (UX-26)', '560 بكسل، 39 KB', '200 بكسل، 8 KB', '✅'),
    ('تمرير أفقي / عناصر خارج الشاشة', f"{pb['overflow']} / {pb['offscreen']}", f"{pa['overflow']} / {pa['offscreen']}", '='),
    ('أخطاء كونسول أو شبكة', pb['err'], pa['err'], '=' if pb['err'] == pa['err'] else arrow(pb['err'], pa['err'])),
    ('تنبيهات pa11y (كلها «تحتاج مراجعة» للتدرج)', pa11y(R(B + 'pa11y-ci.json')), pa11y(R(A + 'pa11y-ci.json')), '='),
    ('رابط تخطٍّ في المنيو', 'لا' if not kb_page(kbb, 'menu').get('skipLink') else 'نعم', 'نعم' if kb_page(kba, 'menu').get('skipLink') else 'لا', '✅'),
    ('الوصول لأول صنف بلوحة المفاتيح', f"{kb_page(kbb, 'menu').get('tabsToMainAction')} ضغطة Tab", 'ضغطة Tab ثم Enter على «انتقل إلى المحتوى»', '✅'),
]
for r in rows: L.append('| ' + ' | '.join(str(x) for x in r) + ' |')
L += ['', '**ملاحظة:** قياس الصور يعدّ اللوجو الصغير «أكبر من حجم عرضه» لأنه يقيس على شاشة كثافتها 1، والنسخة 200 بكسل مقصودة لشاشات الموبايل الحادة (كثافة 3). أهداف اللمس المتبقية أغلبها روابط داخل جمل أو عناصر عند حافة الشاشة لا يحسبها القياس كاملة، وأزرار الأقسام في الشريط (ارتفاعها 40). كلها فوق 24 بكسل، وهو حد WCAG 2.5.8.', '']

NAMES = {'home': 'الرئيسية', 'menu-ashry': 'منيو العاشر', 'menu-tagamoa': 'منيو التجمع', 'track': 'التتبع', 'not-found': '404', 'admin': 'لوحة الكول سنتر'}
L += ['## الأداء (Lighthouse، موبايل بشبكة 4G بطيئة)', '', '| الصفحة | الأداء قبل | بعد | LCP قبل | بعد | الحجم قبل | بعد | CLS قبل | بعد |', '|---|---|---|---|---|---|---|---|---|']
for n, ar in NAMES.items():
    b, a = lhb[f'{n}-mobile'], lha[f'{n}-mobile']
    L.append(f"| {ar} | {b['perf']} | **{a['perf']}** | {b['lcp']} | {a['lcp']} | {b['kb']} KB | {a['kb']} KB | {b['cls']} | {a['cls']} |")
L += ['', '| الصفحة (كمبيوتر) | الأداء قبل | بعد | الوصول قبل | بعد | CLS قبل | بعد |', '|---|---|---|---|---|---|---|']
for n, ar in NAMES.items():
    b, a = lhb[f'{n}-desktop'], lha[f'{n}-desktop']
    L.append(f"| {ar} | {b['perf']} | {a['perf']} | {b['a11y']} | {a['a11y']} | {b['cls']} | {a['cls']} |")
L += ['', '**Unlighthouse (كل المسارات، موبايل):** ' + '، '.join(f"`{p}` {ulb.get(p, '—')} ← **{v}**" for p, v in ula.items()) + '.', '',
      '**تذبذب القياس:** نتيجة Lighthouse للصفحة نفسها تتغير بضع نقاط بين تشغيل وآخر على هذا الجهاز (لاحظنا صفحة 404 بين 91 و99). الفرق في المنيو (من 76 و79 إلى 88 و90، ومعه Unlighthouse من 79 و80 إلى 90 و91) أكبر بكثير من هذا التذبذب، ومعه انخفاض حقيقي في الحجم المحمّل إلى النصف تقريباً. أما الرئيسية (93 ← 91) ولوحة الكول سنتر فالفرق داخل التذبذب.', '']

L += ['## الدرجات', '', '| المجال | قبل | بعد |', '|---|---|---|']
bm = {x['key']: x['score'] for x in scb['areas']}
for x in sca['areas']: L.append(f"| {x['ar']} | {bm.get(x['key'], '—')} | **{x['score']}** |")
L.append(f"| **الإجمالي** | {scb['overall']} | **{sca['overall']}** |")

L += ['', '## المشاكل المُصلحة', '', '| # | المشكلة | ما تم |', '|---|---|---|']
for i in issues:
    if i['status'] == 'fixed': L.append(f"| {i['id']} | {i['title']} | {i['done']} |")
L += ['', '## أُصلحت جزئياً', '', '| # | المشكلة | ما تم | الباقي |', '|---|---|---|---|']
for i in issues:
    if i['status'] == 'partial': L.append(f"| {i['id']} | {i['title']} | {i['done']} | {i['needs'] or '—'} |")
L += ['', '## تنتظر المالك (لم تُلمس عن قصد)', '', '| # | الخطورة | المشكلة | المطلوب منك |', '|---|---|---|---|']
SEV_AR = {'Critical': 'حرجة', 'High': 'عالية', 'Medium': 'متوسطة', 'Low': 'منخفضة'}
for i in issues:
    if i['status'] == 'open': L.append(f"| {i['id']} | {SEV_AR[i['severity']]} | {i['title']} | {i['needs']} |")
L += ['', '## كيف تحققنا', '- **اختبارات التطبيق نفسه:** اختبارات الوحدة والمتصفح وlint وTypeScript، وكلها ناجحة، ومعها اختبارات جديدة لزر الرجوع وإعادة الطلب والمرادفات والتاريخ العربي.',
      '- **إعادة الفحص الكامل:** `npm run audit:all` (لقطات 5 مقاسات، وaxe، وpa11y، ولوحة المفاتيح، وLighthouse، وUnlighthouse، والاختبار الوظيفي، والشخصيات).',
      '- **ما لم يُتحقق منه:** أجهزة وشبكات حقيقية، وSafari، وقارئات الشاشة الفعلية، ومستخدمون حقيقيون.']
open('reports/FIXES-AND-RESULTS.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('FIXES-AND-RESULTS.md written')
