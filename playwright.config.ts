import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.BASE_URL_OC ?? 'https://host.docker.internal:9200',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry'
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'draw-io-chromium',
      testDir: './packages/web-app-draw-io/tests/e2e',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', ignoreHTTPSErrors: true }
    },
    {
      name: 'drawIO-firefox',
      testDir: './packages/web-app-draw-io/tests/e2e',
      use: { ...devices['Desktop Firefox'], browserName: 'firefox', ignoreHTTPSErrors: true }
    },
    {
      name: 'drawIO-webkit',
      testDir: './packages/web-app-draw-io/tests/e2e',
      use: { ...devices['Desktop Safari'], browserName: 'webkit', ignoreHTTPSErrors: true }
    },
    {
      name: 'unzip-chromium',
      testDir: './packages/web-app-unzip/tests/e2e',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', ignoreHTTPSErrors: true }
    },
    {
      name: 'unzip-firefox',
      testDir: './packages/web-app-unzip/tests/e2e',
      use: { ...devices['Desktop Firefox'], browserName: 'firefox', ignoreHTTPSErrors: true }
    },
    {
      name: 'unzip-webkit',
      testDir: './packages/web-app-unzip/tests/e2e',
      use: { ...devices['Desktop Safari'], browserName: 'webkit', ignoreHTTPSErrors: true }
    },
    {
      name: 'external-sites-chromium',
      testDir: './packages/web-app-external-sites/tests/e2e',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', ignoreHTTPSErrors: true }
    },
    {
      name: 'external-sites-firefox',
      testDir: './packages/web-app-external-sites/tests/e2e',
      use: { ...devices['Desktop Firefox'], browserName: 'firefox', ignoreHTTPSErrors: true }
    },
    {
      name: 'external-sites-webkit',
      testDir: './packages/web-app-external-sites/tests/e2e',
      use: { ...devices['Desktop Safari'], browserName: 'webkit', ignoreHTTPSErrors: true }
    },
    {
      name: 'json-viewer-chromium',
      testDir: './packages/web-app-json-viewer/tests/e2e',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', ignoreHTTPSErrors: true }
    },
    {
      name: 'json-viewer-firefox',
      testDir: './packages/web-app-json-viewer/tests/e2e',
      use: { ...devices['Desktop Firefox'], browserName: 'firefox', ignoreHTTPSErrors: true }
    },
    {
      name: 'json-viewer-webkit',
      testDir: './packages/web-app-json-viewer/tests/e2e',
      use: { ...devices['Desktop Safari'], browserName: 'webkit', ignoreHTTPSErrors: true }
    }

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ]

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
})
