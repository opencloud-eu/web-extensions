import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { createRandomUser } from '../../../../support/helpers/api/apiHelper'
import { PastebinPage } from '../../../../support/pages/pastebinPage'

let userPage: Page
let pastebin: PastebinPage

test.beforeEach(async ({ browser }) => {
  const user = await createRandomUser()
  userPage = (await loginAsUser(browser, user.username, user.password)).page
  pastebin = new PastebinPage(userPage)
})

test.afterEach(async () => {
  await logout(userPage)
})

test.describe('create', () => {
  test('create single-file pastebin', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'Hello from e2e test\nThis is line two' }]
    })

    await pastebin.expectContentVisible('Hello from e2e test')
    await pastebin.expectContentVisible('This is line two')
  })

  test('create pastebin with title', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      title: 'My Test Pastebin',
      files: [{ name: '', content: 'some content here' }]
    })

    // title should appear in the header
    await expect(userPage.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('My Test Pastebin')
  })

  test('create multi-file pastebin', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [
        { name: 'first.py', content: '# first file\nprint("hello")' },
        { name: 'second.js', content: '// second file\nconsole.log("world")' }
      ]
    })

    await pastebin.expectFileVisible('first.py')
    await pastebin.expectFileVisible('second.js')
  })

  test('reject empty content', async () => {
    await pastebin.navigateToPastebin()

    // create button should be disabled when no content is entered
    const createButton = userPage.locator('button', { hasText: 'Create Pastebin' })
    await expect(createButton).toBeDisabled()
  })

  test('remove file editor', async () => {
    await pastebin.navigateToPastebin()

    // add a second file
    await pastebin.addFile()
    await expect(userPage.locator('textarea')).toHaveCount(2)

    // remove the first file editor
    await pastebin.removeFile(0)
    await expect(userPage.locator('textarea')).toHaveCount(1)
  })
})

test.describe('list', () => {
  test('list shows created pastebins', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      title: 'Listed Pastebin',
      files: [{ name: '', content: 'list test content' }]
    })

    await pastebin.navigateToList()
    await expect(pastebin.getPastebinItems().first()).toBeVisible({ timeout: 15000 })
    await expect(pastebin.getPastebinItems().first()).toContainText('Listed Pastebin')
  })

  test('empty state', async () => {
    await pastebin.navigateToPastebin()

    // navigate to list page directly via breadcrumb
    await pastebin.navigateToList()

    // fresh user should see empty state
    await expect(userPage.locator('text=No pastebins yet.')).toBeVisible({ timeout: 15000 })
  })

  test('click item navigates to view', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'navigate test' }]
    })

    await pastebin.navigateToList()
    await pastebin.getPastebinItems().first().click()
    await expect(userPage).toHaveURL(/pastebin\/view\//)
  })

  test('delete from list', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      title: 'Delete Me',
      files: [{ name: '', content: 'to be deleted' }]
    })

    await pastebin.navigateToList()
    await expect(pastebin.getPastebinItems()).toHaveCount(1, { timeout: 15000 })

    await pastebin.deletePastebinFromList(0)

    // item should be removed from the list
    await expect(pastebin.getPastebinItems()).toHaveCount(0, { timeout: 15000 })
  })
})

test.describe('edit', () => {
  test('edit loads existing content', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: 'test.txt', content: 'original content here' }]
    })

    await pastebin.clickEdit()

    // textarea should contain the original content
    const textarea = userPage.locator('textarea').first()
    await expect(textarea).toHaveValue('original content here', { timeout: 15000 })
  })

  test('edit content and save', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: 'test.txt', content: 'before edit' }]
    })

    await pastebin.clickEdit()

    const textarea = userPage.locator('textarea').first()
    await textarea.fill('after edit')
    await pastebin.saveChanges()

    // view should show updated content
    await pastebin.expectContentVisible('after edit')
  })

  test('add new file to pastebin', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: 'first.txt', content: 'first file content' }]
    })

    await pastebin.clickEdit()
    await pastebin.addFile()

    // fill the new file
    await pastebin.fillFile(1, 'second.txt', 'second file content')
    await pastebin.saveChanges()

    // both files should be visible on view page
    await pastebin.expectFileVisible('first.txt')
    await pastebin.expectFileVisible('second.txt')
  })

  test('rename file', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: 'old.txt', content: 'rename test content' }]
    })

    await pastebin.clickEdit()

    const filenameInput = userPage.getByLabel('Filename').first()
    await filenameInput.fill('new.txt')
    await pastebin.saveChanges()

    // old name should be gone, new name should be visible
    await pastebin.expectFileVisible('new.txt')
    await expect(userPage.locator('[data-item-id="old.txt"]')).not.toBeVisible()
  })

  test('cancel returns to view', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'cancel test content' }]
    })

    await pastebin.clickEdit()
    await pastebin.cancelEdit()

    // should be back on view page
    await expect(userPage).toHaveURL(/pastebin\/view\//)
  })
})

test.describe('view', () => {
  test('view shows syntax highlighted content', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: 'hello.py', content: 'print("hello world")' }]
    })

    await pastebin.expectFileVisible('hello.py')

    // the code table should contain the content
    const table = pastebin.getFileContainer('hello.py').locator('table')
    await expect(table).toContainText('print', { timeout: 15000 })
    await expect(table).toContainText('hello world')
  })

  test('copy button exists', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'copy test' }]
    })

    // the copy button should be visible (has title "Copy content")
    await expect(userPage.locator('button[title="Copy content"]')).toBeVisible({ timeout: 15000 })
  })

  test('delete from view', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'will be deleted' }]
    })

    await pastebin.deletePastebinFromView()

    // should redirect to list page after deletion
    await expect(userPage).toHaveURL(/pastebin\/list/, { timeout: 15000 })
  })
})

test.describe('public links', () => {
  test('public link icon visible in header', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'public link test' }]
    })

    // the share link button should be visible in the header
    const linkIcon = userPage.locator('header button[title="Copy public link"]')
    await expect(linkIcon).toBeVisible({ timeout: 15000 })
    const href = await pastebin.getShareLinkHref()
    expect(href).toContain('/pastebin/')
  })

  test('anchor links have scrollTo param', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [
        { name: 'alpha.py', content: '# alpha file' },
        { name: 'beta.js', content: '// beta file' }
      ]
    })

    await pastebin.expectFileVisible('alpha.py')
    await pastebin.expectFileVisible('beta.js')

    // wait for the share URL to resolve (anchor links depend on it)
    const linkIcon = userPage.locator('header button[title="Copy public link"]')
    await expect(linkIcon).toBeVisible({ timeout: 15000 })

    const alphaHref = await pastebin.getAnchorHref('alpha.py')
    expect(alphaHref).toContain('scrollTo=alpha.py')

    const betaHref = await pastebin.getAnchorHref('beta.js')
    expect(betaHref).toContain('scrollTo=beta.js')
  })

  test('public link works unauthenticated', async ({ browser }) => {
    await pastebin.navigateToPastebin()
    const { password } = await pastebin.createPastebin({
      files: [{ name: 'public.txt', content: 'visible without login' }]
    })

    // copy the share link via clipboard
    const shareHref = await pastebin.getShareLinkHref()
    expect(shareHref).toBeTruthy()

    // open in a fresh unauthenticated browser context
    const freshContext = await browser.newContext({ ignoreHTTPSErrors: true })
    const freshPage = await freshContext.newPage()

    await freshPage.goto(shareHref!, { timeout: 30000 })

    // if the link is password-protected, enter the password
    if (password) {
      const passwordField = freshPage.locator('input[type="password"]')
      await expect(passwordField).toBeVisible({ timeout: 15000 })
      await passwordField.fill(password)
      await freshPage.getByRole('button', { name: 'Continue', exact: true }).click()
    }

    // content should be visible without authentication
    await expect(freshPage.locator('[data-item-id="public.txt"]')).toBeVisible({ timeout: 15000 })
    await expect(freshPage.locator('table')).toContainText('visible without login', {
      timeout: 15000
    })

    // edit and delete buttons should NOT be visible (unauthenticated)
    await expect(freshPage.locator('a', { hasText: 'Edit' })).not.toBeVisible()
    await expect(freshPage.locator('button', { hasText: 'Delete' })).not.toBeVisible()

    await freshContext.close()
  })

  // Requires fix in web-pkg: replaceInvalidFileRoute must preserve existing query params
  // See: https://github.com/opencloud-eu/web/pull/2199
  test.skip('scrollTo works on public link', async ({ browser }) => {
    await pastebin.navigateToPastebin()
    const { password } = await pastebin.createPastebin({
      files: [
        { name: 'top.py', content: '# this is the top file\n'.repeat(30) },
        { name: 'bottom.js', content: '// this is the bottom file' }
      ]
    })

    await pastebin.expectFileVisible('top.py')
    await pastebin.expectFileVisible('bottom.js')

    // wait for share URL to resolve, then get anchor href for bottom file
    await expect(userPage.locator('header button[title="Copy public link"]')).toBeVisible({
      timeout: 15000
    })
    const anchorHref = await pastebin.getAnchorHref('bottom.js')
    expect(anchorHref).toContain('scrollTo=bottom.js')

    // open the anchor link in a fresh unauthenticated context
    const freshContext = await browser.newContext({ ignoreHTTPSErrors: true })
    const freshPage = await freshContext.newPage()
    await freshPage.goto(anchorHref!, { timeout: 30000 })

    if (password) {
      const passwordField = freshPage.locator('input[type="password"]')
      await expect(passwordField).toBeVisible({ timeout: 15000 })
      await passwordField.fill(password)
      await freshPage.getByRole('button', { name: 'Continue', exact: true }).click()
    }

    // the bottom file should be visible (scrolled into view)
    await expect(freshPage.locator('[data-item-id="bottom.js"]')).toBeVisible({ timeout: 15000 })

    // scrollTo should be preserved in the URL
    await expect(freshPage).toHaveURL(/scrollTo=bottom\.js/, { timeout: 5000 })

    await freshContext.close()
  })
})

test.describe('navigation', () => {
  test('breadcrumb to list', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'breadcrumb test' }]
    })

    await pastebin.navigateToList()
    await expect(userPage).toHaveURL(/pastebin\/list/)
  })

  test('view to edit to cancel to view', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'round trip test' }]
    })

    await pastebin.clickEdit()
    await expect(userPage).toHaveURL(/pastebin\/edit\//)

    await pastebin.cancelEdit()
    await expect(userPage).toHaveURL(/pastebin\/view\//)
  })

  test('new button from view', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: '', content: 'new button test' }]
    })

    await pastebin.clickNew()

    // should be on create page with empty textarea
    const textarea = userPage.locator('textarea').first()
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveValue('')
  })

  test('closing view after create returns to pastebin list', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: 'ctx.txt', content: 'context route test' }]
    })
    await pastebin.expectFileVisible('ctx.txt')

    await pastebin.closeApp()
    await expect(userPage).toHaveURL(/pastebin\/list/, { timeout: 15000 })
  })

  test('closing view after navigating from list returns to pastebin list', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: 'list-nav.txt', content: 'list navigation test' }]
    })

    // go to list, then click the pastebin to open it
    await pastebin.navigateToList()
    await pastebin.getPastebinItems().first().click()
    await expect(userPage).toHaveURL(/pastebin\/view\//)
    await pastebin.expectFileVisible('list-nav.txt')

    await pastebin.closeApp()
    await expect(userPage).toHaveURL(/pastebin\/list/, { timeout: 15000 })
  })

  test('closing edit page returns to pastebin list', async () => {
    await pastebin.navigateToPastebin()
    await pastebin.createPastebin({
      files: [{ name: 'edit-close.txt', content: 'edit close test' }]
    })

    await pastebin.clickEdit()
    await expect(userPage).toHaveURL(/pastebin\/edit\//)

    await pastebin.closeApp()
    await expect(userPage).toHaveURL(/pastebin\/list/, { timeout: 15000 })
  })
})
