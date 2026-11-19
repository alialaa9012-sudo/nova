import { api } from './api'
import type { VisitStep } from './api/types'
import type { BranchId } from './catalog'
import { cairoDate } from './format'

const KEY = 'km.visit.v1'

/**
 * Records how far this visit got (see visit_funnel in the database), once per step and branch a
 * day. The visit id is random and changes every day; nothing about the person is sent. Automated
 * browsers (tests, speed checks) are not counted.
 */
export function recordStep(step: VisitStep, branchId?: BranchId): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return
    const today = cairoDate(new Date())
    let visit = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { id: string; date: string; done: string[] } | null
    if (!visit || visit.date !== today) visit = { id: crypto.randomUUID(), date: today, done: [] }
    const key = `${step}|${branchId ?? ''}`
    if (visit.done.includes(key)) return
    visit.done.push(key)
    localStorage.setItem(KEY, JSON.stringify(visit))
    void api.logVisit(visit.id, step, branchId).catch(() => undefined)
  } catch {
    /* storage blocked: the visit is simply not counted */
  }
}
