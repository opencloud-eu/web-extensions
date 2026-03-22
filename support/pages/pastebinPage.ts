import { Locator, Page, expect } from '@playwright/test'

export class PastebinPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  // Navigation
  async navigateToPastebin() {
    await this.page.getByLabel('Application Switcher').click()
    await this.page.locator('[data-test-id="app\\.pastebin\\.menuItem"]').click()
    await expect(this.page).toHaveURL(/pastebin/)
  }

  // Create flow
  async fillFile(index: number, filename: string, content: string) {
    const filenameInputs = this.page.getByLabel('Filename')
    const textareas = this.page.locator('textarea')
    if (filename) await filenameInputs.nth(index).fill(filename)
    await textareas.nth(index).fill(content)
  }

  async addFile() {
    await this.page.locator('button', { hasText: 'Add file' }).click()
  }

  /**
   * Creates a pastebin with the given files and optional title.
   * If the server enforces link passwords, fills the password field with a test password.
   * Returns the password used (or empty string if none).
   */
  async createPastebin(opts: {
    title?: string
    files: { name: string; content: string }[]
  }): Promise<{ password: string }> {
    if (opts.title) {
      await this.page.getByLabel('Title').fill(opts.title)
    }
    for (let i = 0; i < opts.files.length; i++) {
      if (i > 0) await this.addFile()
      await this.fillFile(i, opts.files[i].name, opts.files[i].content)
    }

    // Handle password-enforced link creation
    let password = ''
    const passwordInput = this.page.getByLabel('Link password')
    if (await passwordInput.isVisible({ timeout: 500 }).catch(() => false)) {
      password = 'TestPassword!42'
      await passwordInput.fill(password)
    }

    // Wait for the create button to be enabled (password validation may need to complete)
    const createButton = this.page.locator('button', { hasText: 'Create Pastebin' })
    await expect(createButton).toBeEnabled({ timeout: 5000 })
    await createButton.click()
    await expect(this.page).toHaveURL(/pastebin\/view\//)
    return { password }
  }

  // App wrapper
  async closeApp() {
    await this.page.locator('#app-top-bar-close').click()
  }

  // View page helpers
  getFileContainer(filename: string): Locator {
    return this.page.locator(`[data-item-id="${filename}"]`)
  }

  async expectFileVisible(filename: string) {
    await expect(this.getFileContainer(filename)).toBeVisible({ timeout: 15000 })
  }

  async expectContentVisible(text: string) {
    await expect(this.page.locator('table')).toContainText(text, { timeout: 15000 })
  }

  async clickEdit() {
    await this.page.locator('a', { hasText: 'Edit' }).click()
    await expect(this.page).toHaveURL(/pastebin\/edit\//)
  }

  async clickNew() {
    await this.page.locator('a', { hasText: 'New' }).click()
    await expect(this.page).toHaveURL(/pastebin/)
  }

  // Edit page helpers
  async saveChanges() {
    await this.page.locator('button', { hasText: 'Save Changes' }).click()
    await expect(this.page).toHaveURL(/pastebin\/view\//)
  }

  async cancelEdit() {
    await this.page.locator('a', { hasText: 'Cancel' }).click()
    await expect(this.page).toHaveURL(/pastebin\/view\//)
  }

  async removeFile(index: number) {
    // Each editor has a remove button with an oc-icon name="close" rendered inside
    // The button is the last button in the editor header bar
    const editors = this.page.locator('.ext\\:rounded-md')
    await editors.nth(index).locator('button.ext\\:flex-shrink-0').click()
  }

  // List page helpers
  async navigateToList() {
    await this.page.locator('a', { hasText: 'Your Pastebins' }).first().click()
    await expect(this.page).toHaveURL(/pastebin\/list/)
  }

  getPastebinItems() {
    return this.page.locator('.pastebin-item')
  }

  // Delete helpers
  async deletePastebinFromView() {
    await this.page.locator('button', { hasText: 'Delete' }).first().click()
    // Confirm in the ODS modal
    await this.page.locator('.oc-modal-body-actions-confirm').click()
  }

  async deletePastebinFromList(index: number) {
    const item = this.getPastebinItems().nth(index)
    await item.hover()
    await item.locator('.delete-btn').click()
    // Confirm in the ODS modal
    await this.page.locator('.oc-modal-body-actions-confirm').click()
  }

  // Share links
  async getShareLinkHref(): Promise<string | null> {
    const linkIcon = this.page.locator('header a[title]').first()
    if ((await linkIcon.count()) === 0) return null
    return linkIcon.getAttribute('href')
  }

  async getAnchorHref(filename: string): Promise<string | null> {
    const container = this.getFileContainer(filename)
    const anchorLink = container.locator('a[title="Link to this file"]')
    if ((await anchorLink.count()) === 0) return null
    return anchorLink.getAttribute('href')
  }
}
