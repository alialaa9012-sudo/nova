// Read-only: how long the opening logo is on screen on the live site, on three kinds of connection.
// A normal visitor is simulated (navigator.webdriver hidden), because test browsers skip the logo.
import { chromium } from '/home/user/nova/ui-ux-audit/node_modules/playwright/index.mjs'
const URL = 'https://khaliha-mashawy.pages.dev/'
const NETS = {
  'wifi': null,
  '4g': { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpu: 4 },
  'slow-3g': { latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8, cpu: 4 },
}
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const out = {}
for (const [name, net] of Object.entries(NETS)) {
  const runs = []
  for (let i = 0; i < 3; i++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
    const p = await ctx.newPage()
    await p.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      window.__km = {}
      new MutationObserver(() => {
        const s = document.getElementById('splash')
        if (s && s.classList.contains('done') && !window.__km.done) window.__km.done = performance.now()
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] })
    })
    const cdp = await ctx.newCDPSession(p)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    if (net) {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.downloadThroughput, uploadThroughput: net.uploadThroughput })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: net.cpu })
    }
    await p.goto(URL, { waitUntil: 'commit' })
    await p.waitForFunction(() => window.__km.done || !document.getElementById('splash'), null, { timeout: 60000 })
    await p.waitForTimeout(300)
    const r = await p.evaluate(() => {
      const res = (part) => performance.getEntriesByType('resource').find((e) => e.name.includes(part))
      const paint = (n) => performance.getEntriesByType('paint').find((e) => e.name === n)?.startTime
      const logo = res('logo-gold-sm')
      return {
        firstPaint: paint('first-paint'),
        logoLoaded: logo?.responseEnd,
        appScript: res('/assets/index-')?.responseEnd,
        splashHidden: window.__km.done,
      }
    })
    r.logoOnScreen = r.splashHidden && r.logoLoaded ? r.splashHidden - Math.max(r.logoLoaded, r.firstPaint ?? 0) : null
    runs.push(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? null : Math.round(v)])))
    await ctx.close()
  }
  out[name] = runs
}
console.log(JSON.stringify(out, null, 1))
await b.close()
