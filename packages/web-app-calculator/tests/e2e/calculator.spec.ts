import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { createRandomUser } from '../../../../support/helpers/api/apiHelper'

let userPage: Page

test.beforeEach(async ({ browser }) => {
  const user = await createRandomUser()
  userPage = (await loginAsUser(browser, user.username, user.password)).page
  await userPage.context().grantPermissions(['clipboard-read', 'clipboard-write'])
})

test.afterEach(async () => {
  await logout(userPage)
})

test('evaluate expression and copy result', async () => {
  const searchInput = userPage.locator('.oc-search-input')
  await searchInput.fill('=sqrt(4+5)')

  const calculatorResult = userPage.locator('#files-global-search-options .provider').filter({
    hasText: 'Calculator'
  })
  await expect(calculatorResult).toBeVisible()
  await expect(calculatorResult).toContainText('3')

  const copyButton = calculatorResult.locator('button')
  await copyButton.click()

  const clipboardContent = await userPage.evaluate(() => navigator.clipboard.readText())
  expect(clipboardContent).toBe('3')
})
