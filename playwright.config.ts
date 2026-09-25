import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT } from './e2e/constants';

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${E2E_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx e2e/test-server.ts',
    url: `http://localhost:${E2E_PORT}/giris`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
