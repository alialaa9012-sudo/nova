// Keyboard-only use: tab order, visible focus, focus trapping in windows, Escape, skip links.
import { VIEWPORTS, context, launch, writeJSON } from './lib.mjs'
import { addItem, toCheckout } from './states.mjs'

const b = await launch()
const results = []
async function tabWalk(p, max = 60) {
  const seen = []
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab')
    const info = await p.evaluate(() => {
      const e = document.activeElement
      if (!e || e === document.body) return null
      const cs = getComputedStyle(e)
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none')
      const r = e.getBoundingClientRect()
      return { tag: e.tagName.toLowerCase(), name: (e.getAttribute('aria-label') || (e.labels && e.labels[0]?.textContent) || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 35), ring, inView: r.bottom > 0 && r.top < innerHeight, x: Math.round(r.left), y: Math.round(r.top) }
    })
    if (!info) { seen.push({ tag: 'body' }); continue }
    if (seen.length > 2 && seen[0].name === info.name && seen[0].tag === info.tag) break
    seen.push(info)
  }
  return seen
}
const vp = VIEWPORTS[3]
for (const [id, url, setup] of [
  ['home', '/', null],
  ['menu', '/branch/ashry', null],
  ['checkout', '/', (p) => toCheckout(p)],
  ['track', '/track', null],
  ['admin', '/admin', null],
]) {
  const ctx = await context(b, vp); const p = await ctx.newPage()
  await p.goto(url); if (setup) await setup(p)
  await p.evaluate(() => document.activeElement?.blur())
  const walk = await tabWalk(p)
  const firstContentIndex = walk.findIndex((w) => /اطلب الآن|أضف |الاسم|رقم الطلب|جديد/.test(w.name || ''))
  const skip = await p.evaluate(() => [...document.querySelectorAll('a')].some((a) => /تخط|انتقل إلى المحتوى|skip/i.test(a.textContent)))
  results.push({ page: id, tabStops: walk.length, noRing: walk.filter((w) => w.tag !== 'body' && !w.ring).map((w) => w.name || w.tag), tabsToMainAction: firstContentIndex + 1, skipLink: skip, order: walk.slice(0, 14).map((w) => w.name || w.tag) })
  await ctx.close()
}
// Item window: trap, Escape, focus return. Cart window the same.
{
  const ctx = await context(b, vp); const p = await ctx.newPage()
  await p.goto('/branch/ashry')
  await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).focus()
  await p.keyboard.press('Enter'); await p.waitForTimeout(400)
  const inside = []
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); inside.push(await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))) }
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  const back = await p.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  // choose a size with arrows and add with Enter only
  await p.keyboard.press('Enter'); await p.waitForTimeout(400)
  await p.keyboard.press('Tab'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150)
  const sizeChecked = await p.evaluate(() => document.querySelector('[role=dialog] [role=radio][data-state=checked]')?.textContent?.trim())
  results.push({ page: 'item-window', focusTrapped: inside.every(Boolean), escapeReturnsTo: back, arrowKeysChangeSize: sizeChecked })
  await ctx.close()
}
// Zone picker with keyboard only.
{
  const ctx = await context(b, vp); const p = await ctx.newPage()
  await toCheckout(p)
  await p.getByRole('combobox', { name: 'المنطقة' }).focus()
  await p.keyboard.type('اللوتس'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter')
  const zone = await p.getByRole('combobox', { name: 'المنطقة' }).inputValue()
  results.push({ page: 'zone-picker', keyboardChoice: zone })
  // submit empty with Enter in the name field: focus should jump to the first error
  await p.getByLabel('الاسم').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  results.push({ page: 'checkout-submit', focusAfterError: await p.evaluate(() => document.activeElement?.labels?.[0]?.textContent || document.activeElement?.id) })
  await ctx.close()
}
writeJSON('results/keyboard.json', results)
console.log(JSON.stringify(results, null, 1).slice(0, 4000))
await b.close()
