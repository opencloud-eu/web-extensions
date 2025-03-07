import { Locator, Page } from '@playwright/test'

export class DrawIoPage {
  readonly page: Page
  readonly saveBtn: Locator
  readonly closeBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.saveBtn = this.page
      .locator('iframe[title="Draw\\.io editor"]')
      .contentFrame()
      .getByRole('button', { name: 'Save' })
    this.closeBtn = this.page.getByLabel('Close')
  }

  async addContent() {
    await this.page
      .locator('iframe[title="Draw\\.io editor"]')
      .contentFrame()
      .locator('.geSidebar > a:nth-child(5)')
      .click()
    await this.page
      .locator('iframe[title="Draw\\.io editor"]')
      .contentFrame()
      .locator('.geDiagramContainer > svg')
      .click()
  }

  async save() {
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          resp.url().endsWith('drawio') &&
          resp.status() === 204 &&
          resp.request().method() === 'PUT'
      ),
      this.saveBtn.click()
    ])
  }

  async close() {
    await this.closeBtn.click()
  }
}
