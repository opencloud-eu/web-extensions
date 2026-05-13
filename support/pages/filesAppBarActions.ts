import { Locator, Page } from '@playwright/test'
import path from 'path'

export class FilesAppBar {
  readonly page: Page
  readonly uploadBtn: Locator
  readonly uploadFileBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.uploadBtn = this.page.locator('.oc-app-floating-action-button')
    this.uploadFileBtn = this.page.locator('#files-file-upload-input')
  }

  async uploadFile(file: string) {
    const respWaitPromise = this.page.waitForResponse(
      (resp) =>
        [201, 204].includes(resp.status()) &&
        ['POST', 'PUT', 'PATCH'].includes(resp.request().method())
    )
    await this.uploadBtn.click()
    const realPath = path.join('./support/filesForUpload', file)
    await this.uploadFileBtn.setInputFiles(path.resolve(realPath))
    await respWaitPromise
    // close upload menu. Sometimes it hangs
    await this.page.keyboard.press('Escape')
  }
}
