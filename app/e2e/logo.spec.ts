import { expect, test } from '@playwright/test'

// The brand logo lives in public/brand and must be served by the production build.
test('serves the brand logo as a JPEG', async ({ request }) => {
  const res = await request.get('/brand/logo-dark.jpg')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/jpeg')
  expect((await res.body()).length).toBeGreaterThan(10_000)
})
