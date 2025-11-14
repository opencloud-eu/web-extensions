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

test('open gpx file in map viewer', async () => {
  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('konigsee.gpx')

  const file = new FilesPage(userPage)
  await file.openFileInViewer('konigsee.gpx', 'gpx')

  // check map is visible
  await expect(userPage.locator('.app-wrapper .leaflet-container')).toBeVisible()

  // check start and finish markers are visible
  const startAndFinishMarkers = userPage.locator('.app-wrapper .leaflet-marker-icon')
  await expect(startAndFinishMarkers).toHaveCount(2)
})

test('see metadata of the image file.', async () => {
  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('lichtenstein.jpg')

  const file = new FilesPage(userPage)
  await file.openFileDetails('lichtenstein.jpg')

  // check map is visible
  await expect(userPage.locator('div.leafletContainer')).toBeVisible()

  // open and check EXIF tab
  await userPage.locator('#sidebar-panel-exif-select').click()
  const testIds = {
    'exif-panel-dimensions': '3024x4032',
    'exif-panel-cameraMake': 'Google',
    'exif-panel-cameraModel': 'Pixel 4a',
    'exif-panel-focalLength': '4.38 mm',
    'exif-panel-fNumber': 'f/1.73',
    'exif-panel-exposureTime': '1/4695',
    'exif-panel-iso': '-',
    'exif-panel-orientation': '1',
    'exif-panel-takenDateTime': 'Aug 20, 2023',
    'exif-panel-location': '48.406408, 9.258861'
  }

  for (const [testId, expectedValue] of Object.entries(testIds)) {
    const element = userPage.locator(`[data-testid="${testId}"]`)
    await expect(element).toBeVisible()
    await expect(element).toContainText(expectedValue)
  }
})
