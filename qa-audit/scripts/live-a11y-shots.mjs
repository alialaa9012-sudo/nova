// Read-only pass over the live site: screenshots at phone/tablet/desktop sizes, axe-core (WCAG 2.0-2.2 A/AA)
// on every state, console and network errors, and horizontal overflow. No order is placed.
import { chromium } from '/home/user/nova/ui-ux-audit/node_modules/playwright/index.mjs'
import AxeBuilder from '/home/user/nova/ui-ux-audit/node_modules/@axe-core/playwright/dist/index.mjs'
import fs from 'node:fs'
const BASE = 'https://khaliha-mashawy.pages.dev'
const OUT = '/home/user/nova/qa-audit/screenshots/live/'
const SIZES = [['m360', 360, 740], ['m390', 390, 844], ['t768', 768, 1024], ['d1366', 1366, 768], ['d1920', 1920, 1080]]
const STATES = [
  ['home', '/', null],
  ['menu-ashry', '/branch/ashry', null],
  ['menu-search-empty', '/branch/ashry', async (p) => { await p.getByRole('searchbox').first().fill('بيتزا'); await p.waitForTimeout(500) }],
  ['item-sheet', '/branch/ashry', async (p) => { await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); await p.waitForTimeout(500) }],
  ['cart', '/branch/ashry', async (p) => { await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click(); await p.getByRole('button', { name: /عرض السلة/ }).click(); await p.waitForTimeout(500) }],
  ['checkout-errors', '/branch/ashry', async (p) => { await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: /^أضف للسلة/ }).click(); await p.getByRole('button', { name: /عرض السلة/ }).click(); await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click(); await p.waitForTimeout(1500); await p.getByRole('button', { name: /^تأكيد الطلب/ }).click(); await p.waitForTimeout(600) }],
  ['checkout-empty-cart', '/branch/zagazig/checkout', null],
  ['track', '/track', null],
  ['track-not-found', '/track', async (p) => { await p.getByLabel('رقم الطلب').fill('A-9999'); await p.getByLabel('رقم الموبايل').fill('01000000000'); await p.getByRole('button', { name: /عرض حالة الطلب/ }).click(); await p.waitForTimeout(2500) }],
  ['order-no-phone', '/order/A-9999', null],
  ['admin-login', '/admin', null],
  ['admin-login-error', '/admin', async (p) => { await p.getByRole('button', { name: 'دخول' }).click(); await p.waitForTimeout(400) }],
  ['zones-login', '/admin/zones', null],
  ['not-found', '/nope', null],
  ['bad-branch', '/branch/xyz', null],
]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const results = []
for (const [vp, w, h] of SIZES) {
  for (const [name, path, act] of STATES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } })
    const p = await ctx.newPage()
    const errors = []
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)))
    p.on('pageerror', (e) => errors.push('PAGE ' + e.message.slice(0, 160)))
    p.on('requestfailed', (r) => errors.push('NET ' + r.url().slice(0, 100) + ' ' + r.failure()?.errorText))
    p.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`))
    let ok = true
    let httpStatus = null
    try {
      httpStatus = (await p.goto(BASE + path, { waitUntil: 'networkidle' }))?.status() ?? null
      await p.waitForTimeout(600)
      if (act) await act(p)
    } catch (e) { ok = false; errors.push('ACT ' + e.message.split('\n')[0].slice(0, 140)) }
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    const title = await p.title()
    const status = httpStatus
    let axe = []
    if (vp === 'm390' || vp === 'd1366') {
      const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
      axe = r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(' ') }))
    }
    await p.screenshot({ path: `${OUT}${vp}-${name}.jpg`, type: 'jpeg', quality: 70 })
    results.push({ vp, name, ok, title, overflow, status, axe, errors })
    await ctx.close()
  }
}
await b.close()
fs.writeFileSync('/home/user/nova/qa-audit/results/live-a11y-shots.json', JSON.stringify(results, null, 1))
for (const r of results) if (!r.ok || r.overflow > 0 || r.axe.length || r.errors.length) console.log(r.vp, r.name, r.ok ? '' : 'ACTION FAILED', r.overflow > 0 ? 'OVERFLOW ' + r.overflow : '', JSON.stringify(r.axe), r.errors.join(' || '))
console.log('runs', results.length, '| titles:', [...new Set(results.map((r) => r.name + '=' + r.title))].join(' ; '))
console.log('status of /nope and /branch/xyz:', [...new Set(results.map((r) => r.name + ' ' + r.status))].join(', '))
