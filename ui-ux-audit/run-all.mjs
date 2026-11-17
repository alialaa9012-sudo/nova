// Re-runs the whole audit in order. Needs the site running: `npm run serve` in another terminal.
import { execSync } from 'node:child_process'
const run = (title, cmd) => { console.log(`\n▶ ${title}`); execSync(cmd, { stdio: 'inherit' }) }
const LH = (id, path, mode) => `npx lighthouse "http://localhost:4173${path}" ${mode === 'desktop' ? '--preset=desktop' : ''} --chrome-path=/opt/pw-browsers/chromium --chrome-flags="--headless=new --no-sandbox" --output=json --output=html --output-path=results/lighthouse/${id}-${mode} --quiet`
run('بيانات تجريبية (3 طلبات)', 'node tests/make-fixture.mjs')
run('لقطات وفحص بصري وaxe على 5 مقاسات', 'node tests/capture.mjs')
run('لوحة المفاتيح', 'node tests/keyboard.mjs')
try { run('pa11y-ci', 'npx pa11y-ci --config config/pa11y-ci.json --json > results/pa11y-ci.json') } catch { console.log('pa11y-ci وجد تنبيهات (متوقع)') }
for (const [id, path] of [['home', '/'], ['menu-ashry', '/branch/ashry'], ['menu-tagamoa', '/branch/tagamoa'], ['track', '/track'], ['not-found', '/nope'], ['admin', '/admin']])
  for (const mode of ['mobile', 'desktop']) run(`Lighthouse ${id} ${mode}`, LH(id, path, mode))
run('Unlighthouse', 'npx unlighthouse-ci --config-file config/unlighthouse.config.ts --reporter jsonExpanded')
try { run('الاختبار الوظيفي', 'npx playwright test --config playwright.config.mjs') } catch { console.log('بعض الاختبارات فشلت (انظر results/functional.json)') }
run('محاكاة الشخصيات', 'node personas/personas.mjs')
run('التقارير ولوحة النتائج', 'python3 tests/build-reports.py')
console.log('\nانتهى. افتح dashboard/index.html')
