import { Locator, Page } from '@playwright/test'
import util from 'util'

export class AppSwitcher {
  readonly page: Page
  readonly drawIoBtn: Locator
  readonly appSwitcher: Locator
  externalSite: string

  constructor(page: Page) {
    this.page = page
    this.drawIoBtn = this.page.locator('[data-test-id="app\\.draw-io\\.menuItem"]')
    this.appSwitcher = this.page.getByLabel('Application Switcher')
    this.externalSite = '[data-test-id="external-sites-%s"]'
  }

  async clickAppSwitcher() {
    await this.appSwitcher.click()
  }

  async createDrawIoFile() {
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          resp.url().endsWith('drawio') &&
          resp.status() === 201 &&
          resp.request().method() === 'PUT'
      ),
      this.drawIoBtn.click()
    ])
  }

  async openExternalSite(site: string) {
    const externalSite = this.page.locator(util.format(this.externalSite, site))
    await externalSite.click()
  }
}
