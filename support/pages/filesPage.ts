import { Locator, Page } from '@playwright/test'

export class FilesPage {
  readonly page: Page
  readonly uploadBtn: Locator
  readonly extractHereBtnBtn: Locator
  readonly selectAllCheckbox: Locator
  readonly openInJsonViewerBtn: Locator
  readonly openWithButton: Locator
  readonly fileDetailsBtn: Locator
  readonly openInMapViewerBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.extractHereBtnBtn = this.page.locator('.context-menu .oc-files-actions-unzip-archive')
    this.selectAllCheckbox = this.page.getByLabel('Select all')
    this.openInJsonViewerBtn = this.page.locator('.oc-files-actions-json-viewer-trigger')
    this.openWithButton = this.page.locator(
      '//*[@id="oc-files-context-actions-context"]//span[text()="Open with..."]'
    )
    this.fileDetailsBtn = this.page.locator('.oc-files-actions-show-details-trigger')
    this.openInMapViewerBtn = this.page.locator('.oc-files-actions-maps-trigger')
  }

  getResourceNameSelector(resource: string): Locator {
    return this.page.locator(
      `#files-space-table [data-test-resource-name="${resource}"], #tiles-view [data-test-resource-name="${resource}"]`
    )
  }

  async extractZip(file: string) {
    const fileLocator = this.getResourceNameSelector(file)
    await fileLocator.click({ button: 'right' })

    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          resp.url().includes('graph/v1.0/drives/') &&
          resp.status() === 200 &&
          resp.request().method() === 'GET'
      ),
      this.extractHereBtnBtn.click()
    ])
  }

  async deleteAllFromPersonal() {
    await this.page.getByRole('link', { name: 'Navigate to personal files' }).click()
    await this.selectAllCheckbox.check()
    await this.page.getByRole('button', { name: 'Delete' }).click()
  }

  async openFolder(folder: string) {
    const folderLocator = this.getResourceNameSelector(folder)
    await folderLocator.click()
  }

  async openFileDetails(file: string) {
    // wait until tika scan is done. need to get file metadata
    await this.page.waitForTimeout(2000)
    await this.page.reload()

    const fileLocator = this.getResourceNameSelector(file)
    await fileLocator.click({ button: 'right' })
    await this.fileDetailsBtn.click()
  }

  async openFileInViewer(file: string, fileType: 'gpx' | 'json') {
    const fileLocator = this.getResourceNameSelector(file)
    await fileLocator.click({ button: 'right' })
    await this.openWithButton.hover()

    const viewerButton = fileType === 'gpx' ? this.openInMapViewerBtn : this.openInJsonViewerBtn

    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          resp.status() === 200 && resp.request().method() === 'GET' && resp.url().includes(file)
      ),
      viewerButton.click()
    ])
  }
}
