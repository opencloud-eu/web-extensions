# E2e tests

## Structure

```plaintext
web-extensions/
├── packages/
│   ├── web-app-.../        // Tests for the specific web application
│   │   ├── tests/
│   │   │   ├── e2e/        // e2e tests for the application
│   │   │   ├── unit/       // unit tests for the application
├── support/                // Supporting files for tests (helpers, page objects, etc.)
│   ├── helpers/            // Helper functions and utilities
│   │   ├── authHelper.ts
│   │   ├── ...
│   ├── pages/              // Page Object Model (POM) files
│   │   ├── loginPage.ts
│   │   ├── ...
├── playwright.config.js     // Playwright configuration file
```

## Playwright Test Configuration

This Playwright configuration defines multiple projects for testing web applications in different browsers. Each project is assigned its own set of browsers, and the configuration includes settings for parallel test execution, retries, and reporting.

## First Playwright install

Playwright separates its package installation (`pnpm i`) from its browser dependencies to keep the installation lightweight.

Run command to install suported browsers.

```shell
pnpm exec playwright install
```

Use an argument if you want to install a specific browser.

```shell
pnpm exec playwright install webkit
```

### Example Projects

**Draw-IO Tests**:

- **Chromium**: Tests for Draw-IO app using the Chromium browser.
- **Firefox**: Tests for Draw-IO app using the Firefox browser.
- **WebKit**: Tests for Draw-IO app using the Safari WebKit browser.

## Running Tests

## Using Playwright Extension for VSCode

[Install Playwright Extension for VSCode](vscode:extension/ms-playwright.playwright)

## Using the Console (CLI)

### running all tests

```shell
$ pnpm test:e2e
```

### running all tests in project draw-io using chromium

```shell
$ pnpm test:e2e --project="draw-io-chromium"
```

### to see browser please disable headless Mode

```shell
$ pnpm test:e2e --project="draw-io-chromium" packages/web-app-draw-io --headed
```

### running certain test in project draw-io

```shell
$ pnpm test:e2e --project="draw-io-chromium" packages/web-app-draw-io/tests/e2e/createDrawIo.spec.ts
```
