import { defineConfig, devices } from '@playwright/test'

process.env.PLAYWRIGHT_STRICT_UNDERRUNS = '1'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['audio.spec.ts', 'hackrf.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173/ci/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-stability',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base /ci/',
    url: 'http://127.0.0.1:4173/ci/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})