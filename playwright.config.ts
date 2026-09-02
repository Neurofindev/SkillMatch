import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-320', use: { viewport: { width: 320, height: 720 } } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 } } },
    {
      name: 'mobile-landscape',
      use: { viewport: { width: 844, height: 390 } },
    },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'large-1920', use: { viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    command: 'vite preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer:
      Boolean(process.env.SKILLMATCH_MANAGED_PREVIEW) || !process.env.CI,
  },
});
