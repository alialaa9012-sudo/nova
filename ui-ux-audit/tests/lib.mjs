// Shared settings for every audit script. The site is the production build served by
// `vite preview` from ../app; nothing here writes to the app's files.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export const BASE = process.env.AUDIT_BASE || 'http://localhost:4173'
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
/** Monday 12:00 Cairo: every branch open. Closed: Monday 09:00 Cairo. */
export const OPEN = new Date('2027-01-04T10:00:00Z')
export const CLOSED = new Date('2027-01-04T07:00:00Z')
export const VIEWPORTS = [
  { id: 'm360', width: 360, height: 800, mobile: true },
  { id: 'm390', width: 390, height: 844, mobile: true },
  { id: 't768', width: 768, height: 1024, mobile: true },
  { id: 'd1366', width: 1366, height: 768, mobile: false },
  { id: 'd1920', width: 1920, height: 1080, mobile: false },
]
export const out = (...p) => {
  const f = path.join(ROOT, ...p)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  return f
}
export const writeJSON = (rel, data) => fs.writeFileSync(out(rel), JSON.stringify(data, null, 1))
export const readJSON = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
export const launch = () => chromium.launch()

/** A browser context with the fixed clock and optional saved local storage (demo orders). */
export async function context(browser, vp, { clock = OPEN, storage = null, extra = {} } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    deviceScaleFactor: 1,
    baseURL: BASE,
    ...extra,
  })
  await ctx.clock.setFixedTime(clock)
  if (storage) {
    await ctx.addInitScript((data) => {
      if (sessionStorage.getItem('__audit_seeded')) return
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v)
      sessionStorage.setItem('__audit_seeded', '1')
    }, storage)
  }
  return ctx
}
