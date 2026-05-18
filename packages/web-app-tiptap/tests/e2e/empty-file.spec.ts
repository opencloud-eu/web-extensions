import { test, expect, type Page } from '@playwright/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { createRandomUser } from '../../../../support/helpers/api/apiHelper'

let userPage: Page

test.beforeEach(async ({ browser }) => {
  const user = await createRandomUser()
  userPage = (await loginAsUser(browser, user.username, user.password)).page
})

test.afterEach(async () => {
  await logout(userPage)
})

async function openMdInTiptap(page: Page, file: string) {
  const filesPage = new FilesPage(page)
  await filesPage.getResourceNameSelector(file).click({ button: 'right' })
  await page.locator('xpath=//*[contains(@class, "oc-drop")]//span[text()="Open with..."]').hover()
  await page.getByRole('menuitem', { name: 'Tiptap' }).click()
}

test('empty .md file opens cleanly and accepts input', async () => {
  // capture console errors for diagnostic output
  const consoleErrors: string[] = []
  userPage.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  userPage.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

  const bar = new FilesAppBar(userPage)
  await bar.uploadFile('empty-note.md')

  await openMdInTiptap(userPage, 'empty-note.md')
  await expect(userPage).toHaveURL(/tiptap/)
  await expect(userPage.locator('.oc-text-meta', { hasText: 'connected' })).toBeVisible({
    timeout: 10_000
  })

  const editor = userPage.locator('.ProseMirror')
  await expect(editor).toBeVisible({ timeout: 5_000 })

  // The editor must be editable and accept input.
  await editor.click()
  await userPage.keyboard.type('hello from empty')

  await expect(editor).toContainText('hello from empty', { timeout: 3_000 })

  console.log('--- captured console errors ---')
  for (const e of consoleErrors) console.log(e)
})
