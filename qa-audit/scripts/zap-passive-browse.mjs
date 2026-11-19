// Browses the live site through OWASP ZAP (passive scan only): every public page, the menu window,
// the cart, the checkout form (not submitted), tracking with a made-up number, and the staff login
// screen (no sign-in attempt). Nothing is written to the database.
import { chromium } from '/home/user/nova/ui-ux-audit/node_modules/playwright/index.mjs'
const BASE = process.argv[2] ?? 'https://khaliha-mashawy.pages.dev'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: 'http://127.0.0.1:8090' } })
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
const visit = async (path) => { await p.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(800) }
for (const path of ['/', '/branch/ashry', '/branch/zagazig', '/branch/tagamoa', '/track', '/admin', '/admin/zones', '/order/A-9999', '/nope', '/robots.txt', '/sitemap.xml', '/favicon.svg']) await visit(path)
await visit('/branch/ashry')
await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click().catch(() => {})
await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click().catch(() => {})
await p.getByRole('button', { name: /عرض السلة/ }).click().catch(() => {})
await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click().catch(() => {})
await p.waitForTimeout(2500)
await p.getByRole('combobox', { name: 'المنطقة' }).fill('مجاورة').catch(() => {})
await p.waitForTimeout(800)
await visit('/track')
await p.getByLabel('رقم الطلب').fill('A-9999').catch(() => {})
await p.getByLabel('رقم الموبايل').fill('01000000000').catch(() => {})
await p.getByRole('button', { name: /عرض حالة الطلب/ }).click().catch(() => {})
await p.waitForTimeout(3000)
await b.close()
console.log('browsed through ZAP')
