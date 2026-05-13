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

// FIXME: currently skipped because of https://github.com/opencloud-eu/web/pull/2506
// unskip with the next OpenCloud release (v7 probably)
test.skip('extract zip file', async () => {
  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('data.zip')

  const file = new FilesPage(userPage)
  await file.extractZip('data.zip')

  await file.openFolder('data')
  await expect(
    userPage.locator('span.oc-resource-basename', { hasText: 'logo-wide' })
  ).toBeVisible()
  await expect(userPage.locator('span.oc-resource-basename', { hasText: 'lorem' })).toBeVisible()
})
