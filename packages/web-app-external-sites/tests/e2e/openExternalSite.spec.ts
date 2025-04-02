import { test, Page, expect } from '@playwright/test'
import { AppSwitcher } from '../../../../support/pages/appSwitcher'
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

test('open external site', async () => {
  const appSwitcher = new AppSwitcher(userPage)
  await appSwitcher.clickAppSwitcher()

  const [newPage] = await Promise.all([
    userPage.waitForEvent('popup'),
    appSwitcher.openExternalSite('OpenCloud')
  ])
  await expect(newPage).toHaveURL(/https:\/\/opencloud\.eu/)
})
