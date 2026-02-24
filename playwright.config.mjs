import { defineConfig, devices } from '@playwright/test';

const radBrowser = (process.env.RAD_BROWSER || '').toLowerCase();
const radChannel = (process.env.RAD_CHANNEL || '').toLowerCase();
const useBrandedChannel = process.env.RAD_E2E_USE_CHANNEL === '1';

const resolveUse = () => {
  if (!useBrandedChannel) {
    return {
      browserName: 'chromium'
    };
  }

  if (radBrowser === 'edge') {
    return {
      browserName: 'chromium',
      channel: 'msedge'
    };
  }

  if (radBrowser === 'chrome') {
    if (radChannel === 'canary') {
      return {
        browserName: 'chromium',
        channel: 'chrome-canary'
      };
    }

    return {
      browserName: 'chromium',
      channel: 'chrome'
    };
  }

  return {
    browserName: 'chromium'
  };
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    ...resolveUse(),
    baseURL: process.env.RAD_E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run start -- --host 127.0.0.1 --port 4173 --strictPort',
    url: process.env.RAD_E2E_BASE_URL || 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
