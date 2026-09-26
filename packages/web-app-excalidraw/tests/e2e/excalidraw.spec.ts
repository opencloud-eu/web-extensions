import { test, Page, expect } from '@playwright/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { ExcalidrawPage } from '../../../../support/pages/excalidrawPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { createRandomUser } from '../../../../support/helpers/api/apiHelper'

let userPage: Page

test.beforeEach(async ({ browser }) => {
  const user = await createRandomUser()
  userPage = (await loginAsUser(browser, user.username, user.password)).page
})

test.afterEach(async () => {
  if (userPage) {
    await logout(userPage)
  }
})

test('create, draw on and reopen an excalidraw whiteboard', async () => {
  const filesAppBar = new FilesAppBar(userPage)
  await filesAppBar.createNewFile('excalidraw')
  await expect(userPage).toHaveURL(/.*excalidraw/)

  const excalidraw = new ExcalidrawPage(userPage)
  await expect(excalidraw.canvas).toBeVisible()
  await excalidraw.waitForApi()
  expect(await excalidraw.getElementCount()).toBe(0)

  await excalidraw.addRectangle()
  expect(await excalidraw.getElementCount()).toBe(1)

  await excalidraw.save()

  // The scene has to come back from the file, not from a warm Y.Doc.
  await userPage.reload()
  await expect(excalidraw.canvas).toBeVisible()
  await excalidraw.waitForApi()
  await excalidraw.waitForYjsElementCount(1)
  expect(await excalidraw.getElementCount()).toBe(1)
})
