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

// Locators specific to Tiptap rendering. Tiptap mounts on a ProseMirror-managed
// contenteditable; remote cursors come from `@tiptap/extension-collaboration-cursor`.
const tt = {
  content: (p: Page) => p.locator('.ProseMirror').first(),
  awaitConnected: async (p: Page) => {
    await expect(p.locator('.oc-text-meta', { hasText: 'connected' })).toBeVisible({
      timeout: 10_000
    })
  },
  remoteCaret: (p: Page) => p.locator('.collaboration-cursor__caret').first(),
  remoteLabel: (p: Page) => p.locator('.collaboration-cursor__label').first()
}

async function openMdInTiptap(page: Page, file: string) {
  const filesPage = new FilesPage(page)
  await filesPage.getResourceNameSelector(file).click({ button: 'right' })
  await page.locator('xpath=//*[contains(@class, "oc-drop")]//span[text()="Open with..."]').hover()
  await page.getByRole('menuitem', { name: 'Tiptap' }).click()
}

test('open .md in Tiptap, Markdown is rendered as rich text, server connects', async () => {
  const bar = new FilesAppBar(userPage)
  await bar.uploadFile('rich-note.md')

  await openMdInTiptap(userPage, 'rich-note.md')
  await expect(userPage).toHaveURL(/tiptap/)
  await tt.awaitConnected(userPage)

  // Headings should be rendered as h1/h2 (not raw `#` characters).
  await expect(tt.content(userPage).locator('h1')).toHaveText('Rich Note')
  await expect(tt.content(userPage).locator('h2')).toHaveText('Section Two')
  // Inline marks survive.
  await expect(tt.content(userPage).locator('strong')).toHaveText('bold')
  await expect(tt.content(userPage).locator('em')).toHaveText('italic')
  await expect(tt.content(userPage).locator('code')).toHaveText('inline code')
  // Lists survive.
  await expect(tt.content(userPage).locator('ul li')).toHaveCount(3)
  await expect(tt.content(userPage).locator('ol li')).toHaveCount(2)
})

test('switching files via direct navigation rebuilds the realtime provider (Tiptap)', async () => {
  const bar = new FilesAppBar(userPage)
  await bar.uploadFile('rich-note.md')
  await bar.uploadFile('note-alpha.md')

  await openMdInTiptap(userPage, 'rich-note.md')
  await tt.awaitConnected(userPage)
  await expect(tt.content(userPage).locator('h1')).toHaveText('Rich Note')
  const richUrl = userPage.url()

  await userPage.goBack()
  await openMdInTiptap(userPage, 'note-alpha.md')
  await tt.awaitConnected(userPage)
  await expect(tt.content(userPage)).toContainText('Note Alpha')
  const alphaUrl = userPage.url()

  expect(richUrl).not.toBe(alphaUrl)

  await userPage.goto(richUrl)
  await tt.awaitConnected(userPage)
  await expect(tt.content(userPage).locator('h1')).toHaveText('Rich Note')

  await userPage.goto(alphaUrl)
  await tt.awaitConnected(userPage)
  await expect(tt.content(userPage)).toContainText('Note Alpha')
  await expect(tt.content(userPage)).not.toContainText('Rich Note')
})

test.describe('multi-user collaboration via shared Project Space (Tiptap)', () => {
  test.beforeEach(async () => {
    /* override outer beforeEach: no auto user/login */
  })
  test.afterEach(async () => {
    /* override outer afterEach */
  })

  test("user A's caret is rendered in user B's editor with the server-stamped name", async ({
    browser
  }) => {
    const stamp = Date.now()
    const space = await createProjectSpace(`tiptap-${stamp}`)
    const alice = await createRandomUser()
    const bob = await createRandomUser()
    await inviteUserToSpace(space.id, alice.id)
    await inviteUserToSpace(space.id, bob.id)
    const { fileId } = await uploadFileToSpace(
      space,
      'team-note.md',
      '# Team Note\n\nLine alpha.\nLine bravo.\nLine charlie.\nLine delta.\n'
    )

    const aliceSession = await loginAsUser(browser, alice.username, alice.password)
    const bobSession = await loginAsUser(browser, bob.username, bob.password)
    const pageA = aliceSession.page
    const pageB = bobSession.page

    try {
      const fileUrl = `/tiptap/?fileId=${encodeURIComponent(fileId)}`
      await Promise.all([pageA.goto(fileUrl), pageB.goto(fileUrl)])
      await Promise.all([tt.awaitConnected(pageA), tt.awaitConnected(pageB)])
      await expect(tt.content(pageA).locator('h1')).toHaveText('Team Note')
      await expect(tt.content(pageB).locator('h1')).toHaveText('Team Note')

      // Place Alice's caret somewhere in the body text.
      await tt.content(pageA).click({ position: { x: 50, y: 50 } })
      await pageA.keyboard.press('End')

      await expect(tt.remoteCaret(pageB)).toBeVisible({ timeout: 10_000 })
      await expect(tt.remoteLabel(pageB)).toHaveText(alice.username, { timeout: 5_000 })

      // CRDT typing test: Alice types, Bob receives.
      const marker = `TIPTAP-MARK-${stamp}`
      await pageA.keyboard.type(marker)
      await expect(tt.content(pageB)).toContainText(marker, { timeout: 5_000 })
    } finally {
      await logout(pageA)
      await logout(pageB)
    }
  })
})
