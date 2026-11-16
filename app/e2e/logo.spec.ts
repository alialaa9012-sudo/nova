import { expect, test } from '@playwright/test'

// The brand logos live in public/brand and must be served by the production build.
for (const [path, type] of [
  ['/brand/logo.webp', 'image/webp'], // transparent, shown by the app
  ['/brand/logo.png', 'image/png'], // the same logo as PNG, for use outside the site
  ['/brand/logo-dark.jpg', 'image/jpeg'], // the owner's original gold logo
  ['/brand/logo-gold.png', 'image/png'], // the gold logo, transparent, on the dark bands
]) {
  test(`serves ${path}`, async ({ request }) => {
    const res = await request.get(path)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain(type)
    expect((await res.body()).length).toBeGreaterThan(10_000)
  })
}
