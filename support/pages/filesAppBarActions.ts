import { Locator, Page } from '@playwright/test'
import path from 'path'

export class FilesAppBar {
  readonly page: Page
  readonly uploadBtn: Locator
  readonly uploadFileBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.uploadBtn = this.page.locator('#upload-menu-btn')
    this.uploadFileBtn = this.page.locator('#files-file-upload-input')
  }

  async uploadFile(file: string) {
    await this.uploadBtn.click()
    const realPath = path.join('./support/filesForUpload', file)
    const uploadAction: Promise<void> = this.uploadFileBtn.setInputFiles(path.resolve(realPath))

    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          [201, 204].includes(resp.status()) &&
          ['POST', 'PUT', 'PATCH'].includes(resp.request().method())
      ),
      uploadAction
    ])
    // close upload menu. Sometimes it hangs
    await this.page.keyboard.press('Escape')
  }
}
