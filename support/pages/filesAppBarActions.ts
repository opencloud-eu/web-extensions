import { Locator, Page } from '@playwright/test'
import path from 'path'

export class FilesAppBar {
  readonly page: Page
  readonly uploadBtn: Locator
  readonly uploadFileBtn: Locator
  readonly uploadMenu: Locator
  readonly modalConfirmBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.uploadBtn = this.page.locator('.oc-app-floating-action-button')
    this.uploadFileBtn = this.page.locator('#files-file-upload-input')
    this.uploadMenu = this.page.locator('#create-or-upload-drop')
    this.modalConfirmBtn = this.page.locator('.oc-modal-body-actions-confirm')
  }

  // creates a file via the "New" menu entry of the given extension
  async createNewFile(extension: string) {
    const respWaitPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().endsWith(extension) && resp.status() === 201 && resp.request().method() === 'PUT'
    )

    await this.uploadBtn.click()
    await this.page.locator(`.new-file-btn-${extension}`).click()
    await this.modalConfirmBtn.click()
    await respWaitPromise
  }

  async uploadFile(file: string) {
    const respWaitPromise = this.page.waitForResponse(
      (resp) =>
        [201, 204].includes(resp.status()) &&
        ['POST', 'PUT', 'PATCH'].includes(resp.request().method())
    )
    await this.uploadBtn.click()
    // The menu closes on Escape once it has the focus, which it gets when it's shown.
    await this.uploadMenu.waitFor()
    const realPath = path.join('./support/filesForUpload', file)
    await this.uploadFileBtn.setInputFiles(path.resolve(realPath))
    await respWaitPromise
    await this.page.keyboard.press('Escape')
    // Still open, it would cover the file list for the next step.
    await this.uploadMenu.waitFor({ state: 'hidden' })
  }
}
