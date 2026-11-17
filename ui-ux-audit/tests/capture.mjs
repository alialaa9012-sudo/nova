// Visits every state at every viewport: screenshot, page probe, console/network errors, axe.
import AxeBuilder from '@axe-core/playwright'
import { VIEWPORTS, context, launch, out, writeJSON } from './lib.mjs'
import { probe } from './probe.mjs'
import { STATES, storageOf, urlOf } from './states.mjs'

const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null
const b = await launch()
const results = []
const jobs = []
for (const s of STATES) if (!only || only.has(s.id)) for (const vp of VIEWPORTS) jobs.push([s, vp])
let i = 0
async function worker() {
  while (i < jobs.length) {
    const [s, vp] = jobs[i++]
    const r = { state: s.id, page: s.page, title: s.title, vp: vp.id, ok: true }
    const ctx = await context(b, vp, { clock: s.clock, storage: storageOf(s) })
    const p = await ctx.newPage()
    const consoleErrors = [], pageErrors = [], failed = []
    p.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200)))
    p.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)))
    p.on('requestfailed', (q) => failed.push(`${q.url().slice(-60)} ${q.failure()?.errorText}`))
    p.on('response', (res) => res.status() >= 400 && failed.push(`${res.status()} ${res.url().slice(-60)}`))
    try {
      const t0 = Date.now()
      await p.goto(urlOf(s), { waitUntil: 'networkidle' })
      if (s.act) await s.act(p)
      await p.waitForLoadState('networkidle')
      await p.evaluate(() => document.fonts.ready)
      r.ms = Date.now() - t0
      const shot = `screenshots/${vp.id}/${s.id}.jpg`
      await p.screenshot({ path: out(shot), type: 'jpeg', quality: 70 })
      r.screenshot = shot
      if (s.full && (vp.id === 'm390' || vp.id === 'd1366')) { const f = `screenshots/full/${s.id}-${vp.id}.jpg`; await p.screenshot({ path: out(f), type: 'jpeg', quality: 60, fullPage: true }); r.full = f }
      r.probe = await p.evaluate(probe)
      if (vp.id === 'm390' || vp.id === 'd1366') {
        const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
        r.axe = axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))
        r.axeIncomplete = axe.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length }))
      }
    } catch (e) { r.ok = false; r.error = String(e.message || e).split('\n')[0].slice(0, 300); await p.screenshot({ path: out(`screenshots/${vp.id}/${s.id}-ERROR.jpg`), type: 'jpeg', quality: 60 }).catch(() => {}) }
    Object.assign(r, { consoleErrors, pageErrors, failed })
    results.push(r)
    process.stdout.write(r.ok ? '.' : `x(${s.id}/${vp.id})`)
    await ctx.close()
  }
}
await Promise.all([worker(), worker(), worker()])
await b.close()
results.sort((a, c) => a.state.localeCompare(c.state) || a.vp.localeCompare(c.vp))
writeJSON(only ? 'results/capture-partial.json' : 'results/capture.json', results)
console.log(`\n${results.length} runs, ${results.filter((r) => !r.ok).length} failed`)
