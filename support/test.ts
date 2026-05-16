// Single composition point for all e2e fixtures.
// Specs do: `import { test, expect } from '../../../../support/test'`.
// To add a new fixture module: export a `test` from support/fixtures/<name>.ts that
// extends @playwright/test's base, and add it to the mergeTests() call below.
import { mergeTests } from '@playwright/test'
import { test as versionsTest } from './fixtures/versions'

export const test = mergeTests(versionsTest)
export { expect } from '@playwright/test'
