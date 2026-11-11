import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Accessibility scan with axe-core (Deque). Fails on any WCAG 2.x A/AA violation.
test.describe('accessibility @a11y', () => {
  test('home page has no WCAG A/AA violations', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    await testInfo.attach('axe-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    })

    expect(results.violations).toEqual([])
  })
})
