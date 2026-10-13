import { Locator, Page } from '@playwright/test'

export class ApollonPage {
  readonly page: Page
  readonly canvas: Locator
  readonly palette: Locator
  readonly nodes: Locator
  readonly diagramTypes: Locator

  constructor(page: Page) {
    this.page = page
    this.canvas = this.page.locator('.apollon-editor .react-flow')
    this.palette = this.page.getByTestId('apollon-palette')
    this.nodes = this.page.locator('.apollon-editor .react-flow__node')
    this.diagramTypes = this.page.locator('[data-diagram-type]')
  }

  async chooseDiagramType(type: string) {
    await this.page.locator(`[data-diagram-type="${type}"]`).click()
  }

  async dragFirstPaletteElementOntoCanvas() {
    const source = await this.palette.locator('svg').first().boundingBox()
    const target = await this.canvas.boundingBox()
    if (!source || !target) {
      throw new Error('palette or canvas is not visible')
    }
    const targetX = target.x + target.width / 2
    const targetY = target.y + target.height / 2

    await this.page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
    await this.page.mouse.down()
    await this.page.mouse.move(targetX - 100, targetY - 50, { steps: 8 })
    await this.page.mouse.move(targetX, targetY, { steps: 8 })
    await this.page.mouse.up()
  }

  async save() {
    await this.page.locator('#app-save-action:not([disabled])').waitFor()

    const waitRespPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().endsWith('apollon') && resp.status() === 204 && resp.request().method() === 'PUT'
    )

    await this.page.locator('#app-save-action').click()
    await waitRespPromise
  }
}
