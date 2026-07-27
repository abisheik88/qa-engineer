import { defineConfig, devices } from '@playwright/test';

// Minimal, senior-SDET-shaped config: a JSON reporter the pack's analyzers can
// read, traces kept on the first retry, and a hermetic local web server started
// automatically. No hard waits, no external URLs.
export default defineConfig({
  testDir: './tests',
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node server.mjs',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
