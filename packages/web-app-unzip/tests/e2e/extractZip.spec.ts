import { test, Page, expect } from '@playwright/test'
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

// FIXME: skipped until the bundled OpenCloud image ships a web build that contains
// both:
//   - https://github.com/opencloud-eu/web/pull/2506 (services announced before apps
//     init, otherwise uppyService is undefined when the extract handler runs and the
//     archive extraction fails)
//   - https://github.com/opencloud-eu/web/pull/2513 (suppresses a false-positive
//     "Folder already exists" dialog that fires whenever the zip's top-level folder
//     name matches anything in the user's current folder, which is the case for
//     data.zip)
test.skip('extract zip file preserves subfolder structure', async () => {
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
