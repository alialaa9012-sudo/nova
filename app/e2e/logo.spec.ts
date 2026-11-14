import { expect, test } from '@playwright/test'

// The brand logos live in public/brand and must be served by the production build.
for (const [path, type] of [
  ['/brand/logo.png', 'image/png'], // transparent, shown by the app
  ['/brand/logo-dark.jpg', 'image/jpeg'], // kept for dark surfaces
]) {
  test(`serves ${path}`, async ({ request }) => {
    const res = await request.get(path)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain(type)
    expect((await res.body()).length).toBeGreaterThan(10_000)
  })
}
