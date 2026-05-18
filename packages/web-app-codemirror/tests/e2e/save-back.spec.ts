import { expect, test } from '@playwright/test'
import { loginCached, disposeSession } from '../../../../support/helpers/sessionCache'
import {
  uploadFileAsAdmin,
  fetchFileAsAdmin
} from '../../../../support/helpers/api/spaceHelper'

// Save-back verification: type into the collab editor, click the explicit
// Save button in the wrapper top bar, then re-fetch the file through
// WebDAV (admin token, bypasses the collab layer) and assert the typed
// marker is persisted. Covers the round trip CRDT → wrapper save loop →
// WebDAV PUT → OC backend.
test.describe('save-back to native file', () => {
  test('typing then clicking Save persists to OC', async ({ browser }) => {
    const stamp = Date.now()
    const filename = `save-back-${stamp}.md`
    const initial = `initial content ${stamp}\n`
    const file = await uploadFileAsAdmin(filename, initial)

    const adminSession = await loginCached(browser, 'admin', 'admin')
    const page = adminSession.page
    try {
      await page.goto(`/codemirror/?fileId=${encodeURIComponent(file.itemId)}`)
      await expect(page.locator('.oc-text-meta', { hasText: 'connected' })).toBeVisible({
        timeout: 10_000
      })
      await expect(page.locator('.cm-content')).toContainText(initial.trim())

      // Click into editor and type a unique marker after the initial text.
      const marker = `MARKER-${stamp}`
      await page.locator('.cm-content').click()
      await page.keyboard.press('End')
      await page.keyboard.type(marker)

      // The save button enables once the doc is dirty.
      const saveButton = page.getByTestId('collab-save')
      await expect(saveButton).toBeEnabled({ timeout: 5_000 })
      await saveButton.click()
      // After a successful save the button disables again because
      // `hasUnsavedChanges` resets.
      await expect(saveButton).toBeDisabled({ timeout: 5_000 })

      // Read the file straight from OC via WebDAV and assert the marker
      // landed on disk, not just in the live Y.Doc.
      const persisted = await fetchFileAsAdmin(file)
      expect(persisted).toContain(initial.trim())
      expect(persisted).toContain(marker)
    } finally {
      await disposeSession(page)
    }
  })
})
