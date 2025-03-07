import { test, Page, expect } from '@playwright/test'
import { AppSwitcher } from '../../../../support/pages/appSwitcher'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

test.afterEach(async () => {
  await logout(adminPage)
})

test('open external site', async () => {
  const appSwitcher = new AppSwitcher(adminPage)
  await appSwitcher.clickAppSwitcher()

  const [newPage] = await Promise.all([
    adminPage.waitForEvent('popup'),
    appSwitcher.openExternalSite('OpenCloud')
  ])
  await expect(newPage).toHaveURL(/https:\/\/opencloud\.eu/)
})
