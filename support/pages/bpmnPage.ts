import { Locator, Page } from '@playwright/test'

export class BpmnPage {
  readonly page: Page
  readonly canvas: Locator
  readonly toolbar: Locator
  readonly closeBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.canvas = this.page.locator('.bpmn-canvas')
    this.toolbar = this.page.locator('.bpmn-toolbar')
    this.closeBtn = this.page.getByLabel('Close')
  }

  async save() {
    const waitRespPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().endsWith('bpmn') && resp.status() === 204 && resp.request().method() === 'PUT'
    )

    await this.page.keyboard.press('Control+s')
    await waitRespPromise
  }

  async close() {
    await this.closeBtn.click()
  }
}
