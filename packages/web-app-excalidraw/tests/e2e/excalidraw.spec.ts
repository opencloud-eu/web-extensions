import { Page } from '@playwright/test'
import { test, expect } from '../../../../support/test'
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

test('create, draw on and reopen an excalidraw whiteboard', async ({ skipIfWeb }) => {
  // The app takes yjs from the host instead of bundling its own copy. Web shares it
  // since web#3398, before that the app cannot start at all.
  skipIfWeb('<8.1.0', 'needs shared yjs from web#3398')

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

test('load the excalidraw fonts from the app itself', async ({ skipIfWeb }) => {
  skipIfWeb('<8.1.0', 'needs shared yjs from web#3398')

  const filesAppBar = new FilesAppBar(userPage)
  await filesAppBar.createNewFile('excalidraw')

  const excalidraw = new ExcalidrawPage(userPage)
  await expect(excalidraw.canvas).toBeVisible()
  await excalidraw.waitForApi()

  // Excalidraw falls back to a CDN when the app does not serve a font, so the font
  // being usable is not enough: the first request has to succeed against the app.
  const fontResponse = userPage.waitForResponse((resp) =>
    /\/excalidraw-assets\/fonts\/Excalifont\/[^/]+\.woff2$/.test(resp.url())
  )
  expect(await excalidraw.loadFont('Excalifont')).toBe(true)
  expect((await fontResponse).status()).toBe(200)
})
