import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { width: 1440, height: 1200 },
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
