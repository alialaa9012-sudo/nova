import { VIEWPORTS, context, launch, out } from './lib.mjs'
const b = await launch(); const ctx = await context(b, VIEWPORTS[3]); const p = await ctx.newPage()
await p.goto('/branch/ashry')
for (let i = 0; i < 20; i++) await p.keyboard.press('Tab')
const info = await p.evaluate(() => { const e = document.activeElement; const li = e.closest('li'); return { focused: e.getAttribute('aria-label'), focusVisible: e.matches(':focus-visible'), liFocusWithin: li?.matches(':focus-within'), liShadow: li ? getComputedStyle(li).boxShadow : '', btnOutline: getComputedStyle(e).outlineStyle, liClass: li?.className.slice(0, 120) } })
console.log(info)
await p.locator('li:focus-within').screenshot({ path: out('screenshots/evidence/focus-card-tab.jpg'), type: 'jpeg', quality: 80 })
await b.close()
