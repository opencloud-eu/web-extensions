import { expect, test } from '@playwright/test'
import { loginCached, disposeSession } from '../../../../support/helpers/sessionCache'
import {
  uploadFileAsAdmin,
  fetchFileAsAdmin
} from '../../../../support/helpers/api/spaceHelper'

// Save-back verification: type into the collab editor, trigger the host
// AppWrapper's save via Ctrl+S, then re-fetch the file through WebDAV
// (admin token, bypasses the collab layer) and assert the typed marker is
// persisted. Covers the round trip CRDT → update:currentContent emission
// → AppWrapper.save → WebDAV PUT → OC backend.
test.describe('save-back to native file', () => {
  test('typing then Ctrl+S persists to OC', async ({ browser }) => {
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

      // Give the wrapper's debounced serialize → emit a chance to fire so
      // AppWrapper sees the dirty content before we trigger its save.
      await page.waitForTimeout(500)

      // AppWrapper binds Ctrl+S to its own save() via useKeyboardActions.
      await page.keyboard.press('Control+s')

      // Poll OC over WebDAV until the marker lands. AppWrapper doesn't
      // expose a "saving done" signal we can latch onto, so we wait on
      // the side effect.
      await expect
        .poll(async () => await fetchFileAsAdmin(file), { timeout: 10_000 })
        .toContain(marker)

      const persisted = await fetchFileAsAdmin(file)
      expect(persisted).toContain(initial.trim())
      expect(persisted).toContain(marker)
    } finally {
      await disposeSession(page)
    }
  })
})
