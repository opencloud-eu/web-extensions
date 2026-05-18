import { test, expect, type Page } from '@playwright/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { createRandomUser } from '../../../../support/helpers/api/apiHelper'
import {
  createProjectSpace,
  inviteUserToSpace,
  uploadFileToSpace
} from '../../../../support/helpers/api/spaceHelper'

let userPage: Page

test.beforeEach(async ({ browser }) => {
  const user = await createRandomUser()
  userPage = (await loginAsUser(browser, user.username, user.password)).page
})

test.afterEach(async () => {
  await logout(userPage)
})

// Locators specific to our CodeMirror app.
const cm = {
  status: (p: Page) => p.locator('.oc-text-meta', { hasText: '—' }).first(),
  content: (p: Page) => p.locator('.cm-content'),
  awaitConnected: async (p: Page) => {
    await expect(p.locator('.oc-text-meta', { hasText: 'connected' })).toBeVisible({
      timeout: 10_000
    })
  }
}

async function openMdFile(page: Page, file: string) {
  // Right-click the file -> "Open with..." -> "CodeMirror".
  const filesPage = new FilesPage(page)
  await filesPage.getResourceNameSelector(file).click({ button: 'right' })
  // Use the same locator the shared FilesPage helper uses to avoid strict-mode
  // ambiguity with the role-labelled wrapper spans.
  await page.locator('xpath=//*[contains(@class, "oc-drop")]//span[text()="Open with..."]').hover()
  await page.getByRole('menuitem', { name: 'CodeMirror' }).click()
}

test('open .md in CodeMirror, see initial content, server connects', async () => {
  const bar = new FilesAppBar(userPage)
  await bar.uploadFile('note-alpha.md')

  await openMdFile(userPage, 'note-alpha.md')
  await expect(userPage).toHaveURL(/codemirror/)
  await cm.awaitConnected(userPage)
  await expect(cm.content(userPage)).toContainText('ALPHA-1')
  await expect(cm.content(userPage)).not.toContainText('BETA-1')
})

test('switching files via direct navigation rebuilds the realtime provider with no cross-file leak', async () => {
  // Upload two distinct .md files.
  const bar = new FilesAppBar(userPage)
  await bar.uploadFile('note-alpha.md')
  await bar.uploadFile('note-beta.md')

  // Discover the app URL for ALPHA via the file browser.
  await openMdFile(userPage, 'note-alpha.md')
  await cm.awaitConnected(userPage)
  await expect(cm.content(userPage)).toContainText('ALPHA-1')
  const alphaUrl = userPage.url()

  // And likewise for BETA — go back, then open it via the file browser too.
  await userPage.goBack()
  await openMdFile(userPage, 'note-beta.md')
  await cm.awaitConnected(userPage)
  await expect(cm.content(userPage)).toContainText('BETA-1')
  const betaUrl = userPage.url()

  expect(alphaUrl).not.toBe(betaUrl)

  // Now the actual lifecycle assertion: jump directly between the two URLs
  // without going through the folder list. The same Vue component instance
  // handles the route change — watchEffect must tear down the old provider/
  // Y.Doc and build a fresh one for the new file each time.
  await userPage.goto(alphaUrl)
  await cm.awaitConnected(userPage)
  await expect(cm.content(userPage)).toContainText('ALPHA-1')
  await expect(cm.content(userPage)).not.toContainText('BETA-1')

  await userPage.goto(betaUrl)
  await cm.awaitConnected(userPage)
  await expect(cm.content(userPage)).toContainText('BETA-1')
  await expect(cm.content(userPage)).not.toContainText('ALPHA-1')

  await userPage.goto(alphaUrl)
  await cm.awaitConnected(userPage)
  await expect(cm.content(userPage)).toContainText('ALPHA-1')
  await expect(cm.content(userPage)).not.toContainText('BETA-1')
})

// ---------------------------------------------------------------------------
// Multi-user collab: two distinct OC users joined to the same Project Space,
// editing the same .md file. Verifies that User A's caret position and the
// server-stamped identity reach User B through the awareness channel.
// ---------------------------------------------------------------------------
test.describe('multi-user collaboration via shared Project Space', () => {
  // beforeEach in the outer scope runs for every test — opt out of it inside
  // this describe so we can manage two browser contexts manually.
  test.beforeEach(async () => {
    /* override outer beforeEach: no auto user/login */
  })
  test.afterEach(async () => {
    /* override outer afterEach */
  })

  test("user A's caret is rendered in user B's editor with the server-stamped name", async ({
    browser
  }) => {
    // 1) Provision: project space + two users invited as Space Editors,
    //    one .md file uploaded into the space root.
    const stamp = Date.now()
    const space = await createProjectSpace(`collab-${stamp}`)
    const alice = await createRandomUser()
    const bob = await createRandomUser()
    await inviteUserToSpace(space.id, alice.id)
    await inviteUserToSpace(space.id, bob.id)
    const { fileId } = await uploadFileToSpace(
      space,
      'shared-note.md',
      '# Shared Note\n\nLINE-A\nLINE-B\nLINE-C\nLINE-D\nLINE-E\n'
    )

    // 2) Both users log in via OIDC in their own browser contexts.
    const aliceSession = await loginAsUser(browser, alice.username, alice.password)
    const bobSession = await loginAsUser(browser, bob.username, bob.password)
    const pageA = aliceSession.page
    const pageB = bobSession.page

    try {
      // 3) Open the file in CodeMirror via the fileId — AppWrapper resolves
      //    the drive context automatically, no folder navigation needed.
      const fileUrl = `/codemirror/?fileId=${encodeURIComponent(fileId)}`
      await Promise.all([pageA.goto(fileUrl), pageB.goto(fileUrl)])
      await Promise.all([cm.awaitConnected(pageA), cm.awaitConnected(pageB)])
      await expect(cm.content(pageA)).toContainText('LINE-C')
      await expect(cm.content(pageB)).toContainText('LINE-C')

      // 4) Alice puts her caret on line 4 ("LINE-B") and goes to end-of-line.
      await pageA.locator('.cm-line').nth(3).click()
      await pageA.keyboard.press('End')

      // 5) Bob's editor must render Alice's remote caret on the same line,
      //    labelled with her *server-stamped* display name (not whatever
      //    Bob's awareness would have inferred).
      const remoteCaretInB = pageB.locator('.cm-ySelectionCaret').first()
      await expect(remoteCaretInB).toBeVisible({ timeout: 10_000 })

      const remoteLabelInB = pageB.locator('.cm-ySelectionInfo').first()
      await expect(remoteLabelInB).toHaveText(alice.username, { timeout: 5_000 })

      // Position assertion: the caret sits inside the same line index.
      const lineFourInB = pageB.locator('.cm-line').nth(3)
      await expect(lineFourInB.locator('.cm-ySelectionCaret')).toHaveCount(1, {
        timeout: 5_000
      })

      // 6) Move Alice to line 6 ("LINE-D"); Bob's caret should follow,
      //    and the previous line must no longer carry it.
      await pageA.locator('.cm-line').nth(5).click()
      await pageA.keyboard.press('End')

      const lineSixInB = pageB.locator('.cm-line').nth(5)
      await expect(lineSixInB.locator('.cm-ySelectionCaret')).toHaveCount(1, {
        timeout: 5_000
      })
      await expect(lineFourInB.locator('.cm-ySelectionCaret')).toHaveCount(0, {
        timeout: 5_000
      })

      // 7) And a CRDT typing test for good measure: Alice types a marker,
      //    Bob sees it.
      const marker = `MARK-${stamp}`
      await pageA.keyboard.type(marker)
      await expect(cm.content(pageB)).toContainText(marker, { timeout: 5_000 })
    } finally {
      await logout(pageA)
      await logout(pageB)
    }
  })
})
