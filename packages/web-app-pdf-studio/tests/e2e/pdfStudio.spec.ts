import { test, Page, expect } from '@playwright/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { PdfStudioPage } from '../../../../support/pages/pdfStudioPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { createRandomUser } from '../../../../support/helpers/api/apiHelper'

let userPage: Page
let pdfStudio: PdfStudioPage

test.beforeEach(async ({ browser }) => {
  const user = await createRandomUser()
  userPage = (await loginAsUser(browser, user.username, user.password)).page
  await new FilesAppBar(userPage).uploadFile('form.pdf')
  pdfStudio = new PdfStudioPage(userPage)
  await pdfStudio.open('form.pdf')
})

test.afterEach(async () => {
  await logout(userPage)
})

test('fill and save a form', async () => {
  await pdfStudio.formField('name').fill('Jane Doe')
  await pdfStudio.formField('agree').check()
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.formField('name')).toHaveValue('Jane Doe')
  await expect(pdfStudio.formField('agree')).toBeChecked()
})

test('run form scripts', async () => {
  // Form scripts run in a WebAssembly sandbox. OpenCloud's default CSP doesn't allow
  // WebAssembly (see the README), forms work without their scripts then.
  const canRunWebAssembly = await userPage.evaluate(async () => {
    try {
      await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
      return true
    } catch {
      return false
    }
  })
  test.skip(!canRunWebAssembly, "The CSP doesn't allow WebAssembly, form scripts can't run")

  // The fixture calculates "sum" from "a" and "b" with form JavaScript. The scripts run once
  // PDF.js' sandbox is loaded, which can take a moment on slow machines.
  await expect(async () => {
    for (const [name, value] of [
      ['a', '2'],
      ['b', '3']
    ]) {
      await pdfStudio.formField(name).fill(value)
      await pdfStudio.formField(name).press('Tab')
    }
    await expect(pdfStudio.formField('sum')).toHaveValue('5', { timeout: 2000 })
  }).toPass({ timeout: 20000 })
})

test('add and save a text annotation', async () => {
  await pdfStudio.addText('Hello PDF Studio')
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.viewer.locator('.annotationLayer .freeTextAnnotation')).toHaveCount(1)
})

test('move a text annotation', async () => {
  await pdfStudio.addText('Move me')
  await pdfStudio.selectTextTool()
  const text = pdfStudio.textAnnotation('Move me')
  // PDF.js only drags selected annotations.
  await text.click()
  await expect(text).toHaveClass(/selectedEditor/)
  const before = await text.boundingBox()
  await pdfStudio.dragBy(text, 120, 80)
  const after = await text.boundingBox()
  expect(after.x - before.x).toBeCloseTo(120, -1)
  expect(after.y - before.y).toBeCloseTo(80, -1)
})

// Like in the PDF.js viewer.
test('drawing settings change the drawing, a new one starts with the defaults', async () => {
  const thickness = userPage.locator('#pdf-studio-ink-settings .pdf-studio-ink-thickness input')
  async function openSettings() {
    await userPage.locator('#pdf-studio-ink-settings-toggle').click()
    await expect(thickness).toBeVisible()
  }
  async function draw(y: number) {
    const box = await pdfStudio.pages.first().boundingBox()
    await userPage.mouse.move(box.x + 60, box.y + y)
    await userPage.mouse.down()
    await userPage.mouse.move(box.x + 160, box.y + y + 20, { steps: 5 })
    await userPage.mouse.up()
  }

  await userPage.locator('.pdf-studio-tool-ink').click()
  await draw(300)
  await openSettings()
  await thickness.fill('10')
  await userPage.keyboard.press('Escape')
  await draw(380)
  await openSettings()
  await expect(thickness).toHaveValue('1')
  await userPage.keyboard.press('Escape')

  await pdfStudio.viewer.locator('.inkEditor').first().click({ force: true })
  await openSettings()
  await expect(thickness).toHaveValue('10')
})

test('add and save a signature', async () => {
  await userPage.locator('.pdf-studio-tool-signature').click()
  const modal = userPage.locator('.pdf-studio-signature-modal')
  await modal.locator('.pdf-studio-signature-tab-type').click()
  await modal.locator('.pdf-studio-signature-type input').fill('Jane Doe')
  await modal.locator('.oc-modal-body-actions-confirm').click()
  await expect(pdfStudio.viewer.locator('.signatureEditor')).toHaveCount(1)
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.viewer.locator('.annotationLayer .stampAnnotation')).toHaveCount(1)
})

test('draw a signature', async () => {
  await userPage.locator('.pdf-studio-tool-signature').click()
  const modal = userPage.locator('.pdf-studio-signature-modal')
  await modal.locator('.pdf-studio-signature-tab-draw').click()
  const box = await modal.locator('.pdf-studio-signature-draw').boundingBox()
  await userPage.mouse.move(box.x + 40, box.y + 60)
  await userPage.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await userPage.mouse.move(box.x + 40 + i * 15, box.y + 60 + (i % 2) * 30)
  }
  await userPage.mouse.up()
  await modal.locator('.oc-modal-body-actions-confirm').click()
  await expect(pdfStudio.viewer.locator('.signatureEditor')).toHaveCount(1)
})

test('delete a page and save', async () => {
  await expect(pdfStudio.pages).toHaveCount(2)
  await pdfStudio.deletePage(2)
  await expect(pdfStudio.pages).toHaveCount(1)
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.pages).toHaveCount(1)
  await expect(pdfStudio.formField('name')).toBeVisible()
})

test('find text', async () => {
  await pdfStudio.find('Second page')
  await expect(userPage.locator('.pdf-studio-find-result')).toHaveText('1 of 1 match')
})

test('comment on selected text', async () => {
  await pdfStudio.selectText('PDF Studio form')
  await pdfStudio.addCommentToSelection('Looks good')
  // The comment is attached to a new highlight.
  await expect(pdfStudio.viewer.locator('.highlightEditor')).toHaveCount(1)
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await pdfStudio.viewer.locator('.annotationCommentButton').first().click()
  await expect(userPage.locator('.pdf-studio-comment-popup')).toContainText('Looks good')
  await userPage.locator('.pdf-studio-tool-comments').click()
  await expect(userPage.locator('.pdf-studio-comment-item')).toContainText('Looks good')
})
