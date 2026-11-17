import { chromium } from '@playwright/test'
const b = await chromium.launch()
for (const [w, h, f] of [[1366, 900, 'dash-1366.jpg'], [390, 844, 'dash-390.jpg']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.goto('file://' + process.cwd() + '/dashboard/index.html'); await p.waitForTimeout(800)
  const broken = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length)
  const ovx = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await p.screenshot({ path: 'screenshots/' + f, type: 'jpeg', quality: 70 })
  console.log(w, 'errors', errs, 'broken imgs', broken, 'overflowX', ovx, 'issues rows', await p.locator('#issues tr').count())
}
await b.close()
