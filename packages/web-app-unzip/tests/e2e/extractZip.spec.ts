import { test, Page, expect } from '@playwright/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

test.afterEach(async () => {
  const file = new FilesPage(adminPage)
  await file.deleteAllFromPersonal()
  await logout(adminPage)
})

test('extract zip file', async () => {
  const uploadFile = new FilesAppBar(adminPage)
  await uploadFile.uploadFile('data.zip')

  const file = new FilesPage(adminPage)
  await file.extractZip('data.zip')

  await file.openFolder('data')
  await expect(
    adminPage.locator('span.oc-resource-basename', { hasText: 'logo-wide' })
  ).toBeVisible()
  await expect(adminPage.locator('span.oc-resource-basename', { hasText: 'lorem' })).toBeVisible()
})
