// Functional UX tests against the production build of ../app (served by vite preview).
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  testMatch: /functional\.spec\.mjs/,
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results/functional.json' }]],
  use: { baseURL: 'http://localhost:4173', locale: 'ar-EG', timezoneId: 'Africa/Cairo', trace: 'off', screenshot: 'only-on-failure', permissions: ['clipboard-read', 'clipboard-write'] },
  outputDir: 'logs/functional-artifacts',
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }],
  webServer: { command: 'npm run serve', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120000 },
})
