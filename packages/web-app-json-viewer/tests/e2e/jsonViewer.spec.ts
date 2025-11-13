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

test('open json file', async () => {
  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('file.json')

  const file = new FilesPage(userPage)
  await file.openFileInViewer('file.json', 'json')
  await expect(userPage).toHaveURL(/json-viewer/)
  await expect(userPage.locator('#json-viewer')).toBeVisible()
})
