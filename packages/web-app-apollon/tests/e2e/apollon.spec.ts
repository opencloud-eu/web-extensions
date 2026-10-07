import { Page } from '@playwright/test'
import { test, expect } from '../../../../support/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { ApollonPage } from '../../../../support/pages/apollonPage'
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

test('create, draw on and reopen an apollon diagram', async ({ skipIfWeb }) => {
  skipIfWeb('<8.1.0', 'needs shared yjs from web#3398')

  const filesAppBar = new FilesAppBar(userPage)
  await filesAppBar.createNewFile('apollon')
  await expect(userPage).toHaveURL(/.*apollon/)

  const apollon = new ApollonPage(userPage)
  await expect(apollon.diagramTypes).toHaveCount(13)

  await apollon.chooseDiagramType('ClassDiagram')
  await expect(apollon.canvas).toBeVisible()
  await expect(apollon.nodes).toHaveCount(0)

  // Saved once before drawing: the save button then only becomes available again when the
  // session has reported the new element, so the second save cannot write a stale diagram.
  await apollon.save()

  await apollon.dragFirstPaletteElementOntoCanvas()
  await expect(apollon.nodes).toHaveCount(1)

  await apollon.save()

  await userPage.reload()
  await expect(apollon.canvas).toBeVisible()
  await expect(apollon.nodes).toHaveCount(1)
  await expect(apollon.diagramTypes).toHaveCount(0)
})
