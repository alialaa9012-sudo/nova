// Reliability on the live site: what a customer sees when things go wrong. Nothing is written:
// the branch is closed at the hour this runs, so the server refuses the order, and the other
// failures are simulated inside the test browser only.
import { chromium } from '/home/user/nova/ui-ux-audit/node_modules/playwright/index.mjs'
const BASE = 'https://khaliha-mashawy.pages.dev'
const SHOTS = '/home/user/nova/qa-audit/screenshots/round2'
const NOON = new Date('2026-11-21T10:00:00Z') // the browser believes it is Saturday noon in Cairo
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const results = []
const run = async (name, fn) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await ctx.clock.setFixedTime(NOON)
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)))
  try {
    const out = await fn(p, ctx)
    results.push({ name, ok: true, ...out, pageErrors: errors })
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message).split('\n')[0].slice(0, 200), pageErrors: errors })
    await p.screenshot({ path: `${SHOTS}/rel-${name}-failed.png` }).catch(() => {})
  }
  await ctx.close()
}
const toCheckout = async (p) => {
  await p.goto(`${BASE}/branch/ashry`)
  await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click()
  const s = p.getByRole('dialog', { name: 'صدور فراخ' })
  await s.getByRole('radio').first().click()
  await s.getByRole('button', { name: /أضف للسلة/ }).click()
  await p.getByRole('button', { name: /عرض السلة/ }).click()
  await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await p.getByRole('radio', { name: 'استلام من الفرع' }).click()
  await p.getByLabel('الاسم').fill('اختبار اعتمادية')
  await p.getByLabel('رقم الموبايل').fill('01000000124')
}
const alertText = async (p) => (await p.locator('[role=alert]').allInnerTexts()).join(' | ').slice(0, 200)

// 1. The server refuses the order (the branch is really closed now): clear message, cart kept.
await run('server-refuses-order', async (p) => {
  await toCheckout(p)
  await p.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  await p.waitForTimeout(4000)
  await p.screenshot({ path: `${SHOTS}/rel-server-refuses.png` })
  return { url: p.url(), message: await alertText(p), stillOnCheckout: p.url().includes('/checkout') }
})

// 2. The connection drops right when the customer confirms.
await run('offline-on-confirm', async (p, ctx) => {
  await toCheckout(p)
  await ctx.setOffline(true)
  await p.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  await p.waitForTimeout(4000)
  await p.screenshot({ path: `${SHOTS}/rel-offline-confirm.png` })
  const msg = await alertText(p)
  await ctx.setOffline(false)
  return { message: msg, stillOnCheckout: p.url().includes('/checkout'), nameKept: await p.getByLabel('الاسم').inputValue() }
})

// 3. The database cannot be reached at all: does the menu still work, and what does checkout say?
await run('database-unreachable', async (p) => {
  await p.route('**/*.supabase.co/**', (r) => r.abort())
  await p.goto(`${BASE}/branch/tagamoa`)
  const items = await p.getByRole('button', { name: /^أضف / }).count()
  await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click()
  const s = p.getByRole('dialog', { name: 'صدور فراخ' })
  await s.getByRole('radio').first().click()
  await s.getByRole('button', { name: /أضف للسلة/ }).click()
  await p.getByRole('button', { name: /عرض السلة/ }).click()
  await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await p.waitForTimeout(3000)
  await p.getByRole('combobox', { name: 'المنطقة' }).fill('اللوتس').catch(() => {})
  await p.waitForTimeout(1000)
  await p.screenshot({ path: `${SHOTS}/rel-db-down-checkout.png` })
  const zoneOptions = await p.getByRole('option').count()
  const zoneEmptyText = (await p.locator('[role=listbox], [role=status]').allInnerTexts()).join(' | ').slice(0, 160)
  await p.goto(`${BASE}/track`)
  await p.getByLabel('رقم الطلب أو رقم الموبايل').fill('01000000124')
  await p.getByRole('button', { name: 'عرض حالة الطلب' }).click()
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${SHOTS}/rel-db-down-track.png` })
  return { menuItems: items, zoneOptions, zoneText: zoneEmptyText, trackMessage: await alertText(p) }
})

// 4. Reloading keeps the cart and what was typed at checkout.
await run('reload-keeps-cart-and-form', async (p) => {
  await toCheckout(p)
  await p.waitForTimeout(600)
  await p.reload()
  await p.waitForTimeout(2500)
  return { name: await p.getByLabel('الاسم').inputValue(), phone: await p.getByLabel('رقم الموبايل').inputValue(), total: (await p.getByRole('button', { name: /^تأكيد الطلب/ }).innerText()).replace(/\s+/g, ' ') }
})

// 5. A page that does not exist, and a direct link to a deep page.
await run('unknown-and-deep-links', async (p) => {
  const r1 = await p.goto(`${BASE}/branch/cairo`)
  const t1 = await p.getByRole('heading', { level: 1 }).first().innerText()
  const r2 = await p.goto(`${BASE}/this/does/not/exist`)
  const r3 = await p.goto(`${BASE}/branch/zagazig/checkout`)
  await p.waitForTimeout(1500)
  return { unknownBranch: [r1.status(), t1], unknownPath: r2.status(), deepCheckout: [r3.status(), (await p.getByRole('heading', { level: 1 }).first().innerText())] }
})

// 6. A very slow connection (slow 3G): the first screen still arrives and works.
await run('slow-3g', async (p, ctx) => {
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024 })
  const t0 = Date.now()
  await p.goto(`${BASE}/branch/zagazig`, { timeout: 90000 })
  await p.getByRole('button', { name: /^أضف / }).first().waitFor({ timeout: 90000 })
  return { secondsToUsableMenu: Math.round((Date.now() - t0) / 100) / 10 }
})

console.log(JSON.stringify(results, null, 1))
await b.close()
