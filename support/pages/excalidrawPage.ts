import { Locator, Page } from '@playwright/test'

/**
 * Excalidraw paints the whole scene into a single `<canvas>`, so there is no per element DOM to
 * assert on. The app exposes the live `ExcalidrawImperativeAPI` on `window.__excalidrawAPI`
 * instead, which is also the only reliable way to add an element: driving the canvas with
 * pointer events is brittle.
 */
export class ExcalidrawPage {
  readonly page: Page
  readonly canvas: Locator
  readonly closeBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.canvas = this.page.locator('.excalidraw-host canvas').first()
    this.closeBtn = this.page.locator('#app-top-bar-close')
  }

  async waitForApi() {
    await this.page.waitForFunction(() => Boolean(window.__excalidrawAPI))
  }

  async waitForYjsElementCount(count: number) {
    await this.page.waitForFunction(
      (expectedCount) => window.__excalidrawYDoc?.getArray('elements').length === expectedCount,
      count
    )
  }

  getElementCount(): Promise<number> {
    return this.page.evaluate(() => window.__excalidrawAPI.getSceneElements().length)
  }

  async addRectangle() {
    const expectedCount = await this.page.evaluate(() => {
      const api = window.__excalidrawAPI
      const existing = api.getSceneElements()
      api.updateScene({
        elements: [
          ...existing,
          {
            id: `rect-${Date.now()}`,
            // Excalidraw orders elements by a fractional index.
            index: `a${existing.length}` as never,
            type: 'rectangle',
            x: 100,
            y: 100,
            width: 200,
            height: 100,
            angle: 0,
            strokeColor: '#1e1e1e',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 2,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: null,
            seed: 1,
            version: 1,
            versionNonce: 1,
            isDeleted: false,
            boundElements: null,
            updated: 1,
            link: null,
            locked: false
          }
        ]
      })
      return existing.length + 1
    })
    await this.waitForYjsElementCount(expectedCount)
  }

  async save() {
    await this.page.locator('#app-save-action:not([disabled])').waitFor()

    const waitRespPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().endsWith('excalidraw') &&
        resp.status() === 204 &&
        resp.request().method() === 'PUT'
    )

    await this.page.keyboard.press('Control+s')
    await waitRespPromise
  }

  async close() {
    await this.closeBtn.click()
  }
}
