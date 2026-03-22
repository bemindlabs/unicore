import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:3100';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: DASHBOARD_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup — must run before authenticated dashboard tests
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // Dashboard tests (port 3000) — require auth setup
    {
      name: 'dashboard',
      testMatch: /e2e\/dashboard\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: DASHBOARD_URL,
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Platform tests (port 3100) — no auth required
    {
      name: 'platform',
      testMatch: /e2e\/platform\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: PLATFORM_URL,
      },
    },

    // General chromium for all other e2e tests
    {
      name: 'chromium',
      testMatch: /e2e\/[^/]+\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter dashboard dev',
      url: DASHBOARD_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter unicore-platform dev',
      url: PLATFORM_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
