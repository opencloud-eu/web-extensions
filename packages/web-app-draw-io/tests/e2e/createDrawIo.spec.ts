import { test, Page, expect } from '@playwright/test'
import { AppSwitcher } from '../../../../support/pages/appSwitcher'
import { DrawIoPage } from '../../../../support/pages/drawIoPage'
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

test('create drawio file', async () => {
  const appSwitcher = new AppSwitcher(userPage)
  await appSwitcher.clickAppSwitcher()
  await appSwitcher.createDrawIoFile()
  await expect(userPage).toHaveURL(/.*draw-io/)

  const drawIo = new DrawIoPage(userPage)
  await drawIo.addContent()
  await drawIo.save()
  await drawIo.close()
})
