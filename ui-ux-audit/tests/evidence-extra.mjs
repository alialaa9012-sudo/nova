import { VIEWPORTS, context, launch, out, readJSON } from './lib.mjs'
const b = await launch()
const ctx = await context(b, VIEWPORTS[3], { storage: readJSON('results/fixture-storage.json') }); const p = await ctx.newPage()
await p.goto('/admin'); await p.waitForTimeout(600)
await p.screenshot({ path: out('screenshots/evidence/admin-default-filter-new.jpg'), type: 'jpeg', quality: 75 })
await b.close()
