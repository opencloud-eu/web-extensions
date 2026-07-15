import { test, Page, expect } from '@playwright/test'
import { AppSwitcher } from '../../../../support/pages/appSwitcher'
import { BpmnPage } from '../../../../support/pages/bpmnPage'
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

test('create bpmn file', async () => {
  const appSwitcher = new AppSwitcher(userPage)
  await appSwitcher.clickAppSwitcher()
  await appSwitcher.createBpmnFile()
  await expect(userPage).toHaveURL(/.*bpmn/)

  const bpmnPage = new BpmnPage(userPage)
  await expect(bpmnPage.canvas).toBeVisible()
  await expect(bpmnPage.toolbar).toBeVisible()

  await bpmnPage.save()
  await bpmnPage.close()
})
