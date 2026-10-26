import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:4110',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: process.env.CI ? 'github' : 'list',
  webServer: process.env.TEST_URL
    ? undefined
    : {
        command: 'node server/local.mjs',
        url: 'http://localhost:4110/api/health',
        reuseExistingServer: false,
        env: { PORT: '4110', DB_PATH: '.data/test.sqlite' },
      },
});
