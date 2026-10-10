import { expect, Locator, Page } from '@playwright/test'
import { FilesPage } from './filesPage'

export class PdfStudioPage {
  readonly page: Page
  readonly viewer: Locator
  readonly pages: Locator
  readonly closeBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.viewer = this.page.locator('.pdf-studio .pdfViewer')
    this.pages = this.viewer.locator('.page')
    this.closeBtn = this.page.getByLabel('Close').first()
  }

  async open(file: string) {
    const filesPage = new FilesPage(this.page)
    await filesPage.getResourceNameSelector(file).click({ button: 'right' })
    await filesPage.openWithButton.hover()
    await this.page.locator('.oc-files-actions-pdf-studio-trigger').click()
    await this.pages.first().locator('.canvasWrapper canvas').first().waitFor()
  }

  formField(name: string): Locator {
    return this.viewer.locator(`.annotationLayer [name="${name}"]`)
  }

  async save() {
    const saved = this.page.waitForResponse(
      (resp) => resp.request().method() === 'PUT' && [201, 204].includes(resp.status())
    )
    await this.viewer.click({ position: { x: 5, y: 5 } })
    await this.page.keyboard.press('ControlOrMeta+s')
    await saved
    // AppWrapper takes the saved content as unchanged only after the response is handled,
    // closing before that asks about unsaved changes.
    await expect(this.page.locator('#app-save-action')).toBeDisabled()
  }

  async close() {
    await this.closeBtn.click()
    await this.page.locator('#files-space-table, #tiles-view').first().waitFor()
  }

  async selectTextTool() {
    await this.page.locator('.pdf-studio-tool-freetext').click()
    // PDF.js switches tools asynchronously, clicks on the page before are ignored.
    await this.viewer.locator('.annotationEditorLayer.freetextEditing').first().waitFor()
  }

  async addText(text: string) {
    const tool = this.page.locator('.pdf-studio-tool-freetext')
    await this.selectTextTool()
    const box = await this.pages.first().boundingBox()
    // An empty spot below the form fields of the fixture, inside the default viewport.
    await this.page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height * 0.3, 400))
    await this.viewer.locator('.freeTextEditor .internal[contenteditable="true"]').waitFor()
    await this.page.keyboard.type(text)
    // Leaving the tool commits the text.
    await tool.click()
    await this.viewer.locator('.freeTextEditor', { hasText: text }).waitFor()
  }

  /** Selects text on the first page like a user dragging over it. */
  async selectText(text: string) {
    const box = await this.pages
      .first()
      .locator('.textLayer span', { hasText: text })
      .first()
      .boundingBox()
    await this.page.mouse.move(box.x + 1, box.y + box.height / 2)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 8 })
    await this.page.mouse.up()
  }

  async addCommentToSelection(comment: string) {
    await this.viewer.locator('.textLayer .editToolbar .commentButton').click()
    const modal = this.page.locator('.pdf-studio-comment-modal')
    await modal.locator('textarea').fill(comment)
    await modal.locator('.oc-modal-body-actions-confirm').click()
    await modal.waitFor({ state: 'detached' })
  }

  textAnnotation(text: string): Locator {
    return this.viewer.locator('.freeTextEditor', { hasText: text })
  }

  async dragBy(locator: Locator, dx: number, dy: number) {
    const box = await locator.boundingBox()
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, {
      steps: 10
    })
    await this.page.mouse.up()
  }

  async deletePage(pageNumber: number) {
    await this.page.locator('.pdf-studio-toggle-sidebar').click()
    await this.page
      .locator(`.pdf-studio-thumbnail[data-page-number="${pageNumber}"] .pdf-studio-page-actions`)
      .click()
    await this.page.locator('.pdf-studio-delete-page').filter({ visible: true }).click()
  }

  async find(query: string) {
    await this.page.locator('.pdf-studio-toggle-find').click()
    await this.page.locator('.pdf-studio-find-input input').fill(query)
  }
}
