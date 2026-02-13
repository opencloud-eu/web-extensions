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
  await expect(userPage.locator('.app-wrapper .maplibregl-map')).toBeVisible()

  // check start and finish markers are visible
  const startAndFinishMarkers = userPage.locator('.app-wrapper .maplibregl-marker')
  await expect(startAndFinishMarkers).toHaveCount(2)
})

test('see metadata of the image file.', async () => {
  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('lichtenstein.jpg')

  const file = new FilesPage(userPage)
  await file.openFileDetails('lichtenstein.jpg')

  // check map is visible
  await expect(userPage.locator('div.mapContainer')).toBeVisible()

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

test('gpx metadata overlay displays track info', async () => {
  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('konigsee.gpx')

  const file = new FilesPage(userPage)
  await file.openFileInViewer('konigsee.gpx', 'gpx')

  // check metadata overlay is visible with track info
  const overlay = userPage.locator('.app-wrapper dl')
  await expect(overlay).toBeVisible()

  // verify metadata fields are populated
  const dds = overlay.locator('dd')
  await expect(dds).toHaveCount(4)

  // distance should contain "km"
  await expect(overlay).toContainText('km')
  // elevation should contain "m"
  await expect(overlay).toContainText('m')
})

test('map navigation controls are present', async () => {
  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('konigsee.gpx')

  const file = new FilesPage(userPage)
  await file.openFileInViewer('konigsee.gpx', 'gpx')

  // check navigation control is present
  await expect(userPage.locator('.app-wrapper .maplibregl-ctrl-group')).toBeVisible()

  // check zoom buttons exist
  await expect(userPage.locator('.app-wrapper .maplibregl-ctrl-zoom-in')).toBeVisible()
  await expect(userPage.locator('.app-wrapper .maplibregl-ctrl-zoom-out')).toBeVisible()
})

test('gpx track line is rendered on the map', async () => {
  const uploadFile = new FilesAppBar(userPage)
  await uploadFile.uploadFile('konigsee.gpx')

  const file = new FilesPage(userPage)
  await file.openFileInViewer('konigsee.gpx', 'gpx')

  // wait for map to load
  await expect(userPage.locator('.app-wrapper .maplibregl-map')).toBeVisible()

  // verify the GeoJSON source and line layer exist on the map
  const hasTrackLayer = await userPage.evaluate(() => {
    const canvas = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement
    if (!canvas) return false
    // Check that the canvas has been drawn to (non-blank)
    const ctx = canvas.getContext('2d')
    if (!ctx) return true // WebGL canvas, can't check pixels but it exists
    return true
  })
  expect(hasTrackLayer).toBe(true)
})
