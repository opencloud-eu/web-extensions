import { Page } from '@playwright/test'
import { test, expect } from '../../../../support/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { createRandomUser } from '../../../../support/helpers/api/apiHelper'

let userPage: Page

test.beforeEach(async ({ browser }) => {
  const user = await createRandomUser()
  userPage = (await loginAsUser(browser, user.username, user.password)).page
})

test.afterEach(async () => {
  await logout(userPage)
})

test('extract zip file preserves subfolder structure', async ({ skipIfWeb }) => {
  // Subfolder structure preservation needs both web#2506 (services announced before
  // apps init, otherwise uppyService is undefined when the extract handler runs) and
  // web#2513 (suppresses a false-positive "Folder already exists" dialog).
  skipIfWeb('<=7.0.0', 'needs web#2506 + web#2513')

  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('data.zip')

  const file = new FilesPage(userPage)
  await file.extractZip('data.zip')

  // extraction creates a folder named after the archive
  await file.openFolder('data')
  // the zip's own top-level "data/" folder must be preserved inside
  await expect(userPage.locator('[data-test-resource-name="data"]')).toBeVisible()

  await file.openFolder('data')
  await expect(userPage.locator('[data-test-resource-name="logo-wide.png"]')).toBeVisible()
  await expect(userPage.locator('[data-test-resource-name="lorem.txt"]')).toBeVisible()
  await expect(userPage.locator('[data-test-resource-name="dir"]')).toBeVisible()

  // nested subfolder content must be preserved, not flattened
  await file.openFolder('dir')
  await expect(userPage.locator('[data-test-resource-name="lorem.txt"]')).toBeVisible()
})
