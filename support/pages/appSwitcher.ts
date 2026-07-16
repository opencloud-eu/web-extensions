import { Locator, Page } from '@playwright/test'
import util from 'util'

export class AppSwitcher {
  readonly page: Page
  readonly bpmnBtn: Locator
  readonly drawIoBtn: Locator
  readonly appSwitcher: Locator
  externalSite: string
  dashboardSite: string

  constructor(page: Page) {
    this.page = page
    this.bpmnBtn = this.page.locator('[data-test-id="app\\.bpmn\\.menuItem"]')
    this.drawIoBtn = this.page.locator('[data-test-id="app\\.draw-io\\.menuItem"]')
    this.appSwitcher = this.page.getByLabel('Application Switcher')
    this.externalSite = '[data-test-id="external-sites-%s"]'
    this.dashboardSite = '[data-test-id="external-sites-dashboard-%s"]'
  }

  getExternalSite(site: string) {
    return this.page.locator(util.format(this.externalSite, site))
  }

  getDashboard(name: string) {
    return this.page.locator(util.format(this.dashboardSite, name))
  }

  async openDashboard(name: string) {
    await this.getDashboard(name).click()
  }

  async clickAppSwitcher() {
    await this.appSwitcher.click()
  }

  async createBpmnFile() {
    const respWaitPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().endsWith('bpmn') && resp.status() === 201 && resp.request().method() === 'PUT'
    )

    await this.bpmnBtn.click()
    await respWaitPromise
  }

  async createDrawIoFile() {
    const respWaitPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().endsWith('drawio') && resp.status() === 201 && resp.request().method() === 'PUT'
    )

    await this.drawIoBtn.click()
    await respWaitPromise
  }

  async openExternalSite(site: string) {
    const externalSite = this.page.locator(util.format(this.externalSite, site))
    await externalSite.click()
  }
}
