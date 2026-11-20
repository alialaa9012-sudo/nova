// Browses the live site through OWASP ZAP so the scanner learns every request, including placing
// one pickup order (approved by the owner, 20 Nov 2026), tracking it, and a failed staff sign-in.
// The test order and anything the scan creates are cancelled and deleted afterwards.
import { chromium } from '/home/user/nova/ui-ux-audit/node_modules/playwright/index.mjs'
const BASE = 'https://khaliha-mashawy.pages.dev'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: 'http://127.0.0.1:8090' } })
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } }) // the browser trusts ZAP's own certificate
const p = await ctx.newPage()
const visit = async (path) => { await p.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(800) }
for (const path of ['/', '/branch/ashry', '/branch/zagazig', '/branch/tagamoa', '/track', '/order/99', '/nope', '/robots.txt', '/favicon.svg']) await visit(path)
// One real pickup order, clearly marked as a scan.
await visit('/branch/ashry')
await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click().catch(() => {})
await p.getByRole('dialog').getByRole('radio').first().click().catch(() => {})
await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click().catch(() => {})
await p.getByRole('button', { name: /عرض السلة/ }).click().catch(() => {})
await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click().catch(() => {})
await p.waitForTimeout(2000)
await p.getByRole('radio', { name: 'استلام من الفرع' }).click().catch(() => {})
await p.getByLabel('الاسم').fill('فحص أمني - يحذف').catch(() => {})
await p.getByLabel('رقم الموبايل').fill('01000000123').catch(() => {})
await p.getByLabel(/ملاحظات/).first().fill('طلب فحص أمني تلقائي، سيُلغى ويُحذف').catch(() => {})
await p.getByRole('button', { name: /^تأكيد الطلب/ }).click().catch(() => {})
await p.waitForTimeout(4000)
console.log('after order:', p.url())
// Tracking by number and by phone.
for (const q of ['01000000123', '#99']) {
  await visit('/track')
  await p.getByLabel('رقم الطلب أو رقم الموبايل').fill(q).catch(() => {})
  await p.getByRole('button', { name: /عرض حالة الطلب/ }).click().catch(() => {})
  await p.waitForTimeout(2500)
}
// Staff sign-in with a made-up account (fails), so the sign-in request is in scope.
await visit('/admin')
await p.getByLabel(/البريد|الإيميل/).first().fill('qa-scan@example.com').catch(() => {})
await p.getByLabel(/كلمة/).first().fill('wrong-password-123').catch(() => {})
await p.getByRole('button', { name: /دخول/ }).first().click().catch(() => {})
await p.waitForTimeout(3000)
await b.close()
console.log('browsed through ZAP')
