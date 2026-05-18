import { test, expect, type Page } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { loginCached, disposeSession } from '../../../../support/helpers/sessionCache'
import { createRandomUser } from '../../../../support/helpers/api/apiHelper'
import { uploadFileAsAdmin, inviteUserToFile } from '../../../../support/helpers/api/spaceHelper'

// Owner-vs-recipient collaboration: admin owns a file in their personal
// drive and shares it with a user. Both views of the file MUST end up on
// the same Hocuspocus document so edits cross-pollinate.
//
// The fix lives in CollaborativeWrapper.vue's `documentName` computed:
// prefer `resource.remoteItemId` over `resource.id`, because for a share
// the recipient's local view of the item carries a different id while
// `remoteItemId` points at the owner's canonical item id.
test.describe('owner+recipient collaboration on a shared file', () => {
  const cm = {
    content: (p: Page) => p.locator('.cm-content'),
    awaitConnected: async (p: Page) => {
      await expect(p.locator('.oc-text-meta', { hasText: 'connected' })).toBeVisible({
        timeout: 10_000
      })
    }
  }

  test('admin edits a file, the recipient sees the edit live (and vice-versa)', async ({
    browser
  }) => {
    const stamp = Date.now()
    const file = await uploadFileAsAdmin(
      `cross-share-${stamp}.md`,
      `# Shared with mary\n\nLINE-OWNER-${stamp}\n`
    )

    // Recipient: a fresh random user invited as File Editor.
    const mary = await createRandomUser()
    await inviteUserToFile(file, mary.id)

    // Owner opens the file by its canonical fileId. Admin's session is reused
    // from a cached storageState — first call this run pays the UI-login cost,
    // every subsequent test that touches admin gets a fresh context for free.
    const adminSession = await loginCached(browser, 'admin', 'admin')
    const ownerUrl = `/codemirror/?fileId=${encodeURIComponent(file.itemId)}`
    await adminSession.page.goto(ownerUrl)
    await cm.awaitConnected(adminSession.page)
    await expect(cm.content(adminSession.page)).toContainText(`LINE-OWNER-${stamp}`)

    // Recipient is a freshly created user, so we still go through the UI
    // login flow for her. State caching would help only if the same random
    // user appeared in multiple tests, which is not the case here.
    const marySession = await loginAsUser(browser, mary.username, mary.password)
    await marySession.page.goto(ownerUrl)
    await cm.awaitConnected(marySession.page)
    await expect(cm.content(marySession.page)).toContainText(`LINE-OWNER-${stamp}`)

    try {
      // Owner types — recipient must see it in real time.
      const ownerMark = `OWNER-MARK-${stamp}`
      await adminSession.page.locator('.cm-content').click()
      await adminSession.page.keyboard.press('End')
      await adminSession.page.keyboard.type(ownerMark)
      await expect(cm.content(marySession.page)).toContainText(ownerMark, { timeout: 5_000 })

      // Recipient types — owner must see it too.
      const recipientMark = `RECIPIENT-MARK-${stamp}`
      await marySession.page.locator('.cm-content').click()
      await marySession.page.keyboard.press('End')
      await marySession.page.keyboard.type(recipientMark)
      await expect(cm.content(adminSession.page)).toContainText(recipientMark, {
        timeout: 5_000
      })
    } finally {
      // Admin's storageState stays cached for the next test; just close the
      // context. Mary still goes through full logout to invalidate her token.
      await disposeSession(adminSession.page)
      await logout(marySession.page)
    }
  })
})
