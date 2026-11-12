import { test, Page, expect } from '@playwright/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { PdfStudioPage } from '../../../../support/pages/pdfStudioPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { createPublicLink, createRandomUser } from '../../../../support/helpers/api/apiHelper'

let userPage: Page
let pdfStudio: PdfStudioPage
let user: Awaited<ReturnType<typeof createRandomUser>>

test.beforeEach(async ({ browser }) => {
  user = await createRandomUser()
  userPage = (await loginAsUser(browser, user.username, user.password)).page
  pdfStudio = new PdfStudioPage(userPage)
})

test.afterEach(async () => {
  await logout(userPage)
})

// The fixture is the form fixture with the password "secret".
test('change the pages of a password-protected file, it stays protected', async () => {
  await new FilesAppBar(userPage).uploadFile('encrypted.pdf')
  await pdfStudio.open('encrypted.pdf', { password: 'secret' })
  await expect(pdfStudio.pages).toHaveCount(2)
  // The rebuilt document is encrypted the same way, the password isn't asked again.
  await pdfStudio.deletePage(2)
  await expect(pdfStudio.pages).toHaveCount(1)
  await expect(userPage.locator('.pdf-studio-password-modal')).toHaveCount(0)
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('encrypted.pdf', { password: 'secret' })
  await expect(pdfStudio.pages).toHaveCount(1)
})

// Sticky notes have no editor in PDF.js, their comments are read from the annotations.
test('read the comment of a sticky note, e.g. from Acrobat', async () => {
  await new FilesAppBar(userPage).uploadFile('sticky-note.pdf')
  await pdfStudio.open('sticky-note.pdf')
  await userPage.locator('.pdf-studio-tool-comments').click()
  const item = userPage.locator('.pdf-studio-comment-item')
  await expect(item).toContainText('Sticky note from Acrobat')
  await expect(item).toContainText('Ada')
  await item.click()
  await expect(userPage.locator('.pdf-studio-comment-popup')).toContainText(
    'Sticky note from Acrobat'
  )
})

test('find the outline, attachments and layers in the sidebar', async () => {
  await new FilesAppBar(userPage).uploadFile('structure.pdf')
  await pdfStudio.open('structure.pdf')
  await pdfStudio.openSidebarView('outline')
  const items = userPage.locator('.pdf-studio-outline-item')
  await expect(items).toHaveText(['First page', 'Second page'])
  await items.nth(1).click()
  await expect(userPage.locator('#pdf-studio-page-number')).toHaveValue('2')
  await pdfStudio.openSidebarView('attachments')
  await expect(userPage.locator('.pdf-studio-attachment')).toContainText('invoice.xml')
  await pdfStudio.openSidebarView('layers')
  await expect(userPage.locator('.pdf-studio-layer')).toHaveText(['Background', 'Notes'])
})

// E.g. a link for viewing only: the document without editing tools.
test('view a file through a read-only link', async ({ browser }) => {
  await new FilesAppBar(userPage).uploadFile('form.pdf')
  const password = 'Pdf-Studio-1'
  const url = await createPublicLink(user.username, user.password, 'form.pdf', password)
  const visitorContext = await browser.newContext({ ignoreHTTPSErrors: true })
  try {
    const visitor = await visitorContext.newPage()
    await visitor.goto(url)
    await visitor.locator('input[type="password"]').fill(password)
    await visitor.keyboard.press('Enter')
    // A link to a single file opens it in the default PDF app, e.g. /pdf-viewer/public/….
    await visitor.waitForURL(/\/[\w-]+\/public\/[^/]+\/form\.pdf/)
    await visitor.goto(visitor.url().replace(/\/[\w-]+\/public\//, '/pdf-studio/public/'))
    const visitorStudio = new PdfStudioPage(visitor)
    await visitorStudio.pages.first().locator('.canvasWrapper canvas').first().waitFor()
    await expect(visitorStudio.pages).toHaveCount(2)
    await expect(visitor.locator('.pdf-studio-tool')).toHaveCount(0)
    await expect(visitor.locator('#app-save-action')).toHaveCount(0)
  } finally {
    await visitorContext.close()
  }
})
