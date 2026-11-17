import { VIEWPORTS, context, launch, out } from './lib.mjs'
const b = await launch(); const ctx = await context(b, VIEWPORTS[3]); const p = await ctx.newPage()
await p.goto('/branch/ashry')
for (let i = 0; i < 21; i++) await p.keyboard.press('Tab')
const box = await p.locator('li:focus-within').boundingBox()
await p.screenshot({ path: out('screenshots/evidence/focus-card-ring.jpg'), type: 'jpeg', quality: 85, clip: { x: box.x - 230, y: box.y - 12, width: box.width + 250, height: box.height + 24 } })
await b.close()
