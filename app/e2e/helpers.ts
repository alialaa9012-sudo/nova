import type { Page } from '@playwright/test'

/** Monday 12:00 in Cairo: every branch is open. `setFixedTime` freezes Date; timers keep running. */
export const MONDAY_NOON_CAIRO = new Date('2027-01-04T10:00:00Z')

/** Chooses a delivery zone at checkout by typing part of its name. */
export async function pickZone(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'المنطقة' }).fill(name)
  await page.getByRole('option', { name: new RegExp(name) }).first().click()
}
