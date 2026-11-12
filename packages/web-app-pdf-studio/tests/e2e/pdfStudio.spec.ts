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

test('list all comments and open one from the list', async () => {
  await pdfStudio.selectText('PDF Studio form')
  await pdfStudio.addCommentToSelection('First comment')
  await userPage.locator('.pdf-studio-tool-comments').click()
  const item = userPage.locator('.pdf-studio-comment-item')
  await expect(item).toBeVisible()
  await expect(item).toContainText('First comment')
  await item.click()
  await expect(userPage.locator('.pdf-studio-comment-popup')).toBeVisible()
  await expect(userPage.locator('.pdf-studio-comment-popup')).toContainText('First comment')
})

// Saving right away waits until PDF.js has read the image, a large one takes a moment.
test('add an image and save right away', async () => {
  await pdfStudio.addImage('lichtenstein.jpg')
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.viewer.locator('.annotationLayer .stampAnnotation')).toHaveCount(1)
})

test('describe an image for screen readers', async () => {
  await pdfStudio.addImage('lichtenstein.jpg')
  await pdfStudio.viewer.locator('.stampEditor').click()
  await pdfStudio.viewer.locator('.editToolbar .altText').click()
  const modal = userPage.locator('.pdf-studio-alt-text-modal')
  await modal.locator('.pdf-studio-alt-text-input textarea').fill('A castle on a rock')
  await modal.locator('.oc-modal-body-actions-confirm').click()
  await expect(pdfStudio.viewer.locator('.editToolbar .altText')).toHaveClass(/done/)
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.viewer.locator('.annotationLayer .stampAnnotation')).toHaveAttribute(
    'aria-label',
    'A castle on a rock'
  )
})

test('edit the description of a signature', async () => {
  await userPage.locator('.pdf-studio-tool-signature').click()
  const modal = userPage.locator('.pdf-studio-signature-modal')
  await modal.locator('.pdf-studio-signature-type input').fill('Jane Doe')
  await modal.locator('.oc-modal-body-actions-confirm').click()
  const signature = pdfStudio.viewer.locator('.signatureEditor')
  await signature.click()
  const button = pdfStudio.viewer.locator('.editToolbar .editDescription')
  await expect(button).toHaveAttribute('title', 'Jane Doe')
  await button.click()
  const descriptionModal = userPage.locator('.oc-modal').filter({ hasText: 'Edit description' })
  await descriptionModal.locator('input').fill('My signature')
  await descriptionModal.locator('.oc-modal-body-actions-confirm').click()
  await signature.click()
  await expect(button).toHaveAttribute('title', 'My signature')
})

// The browser's print dialog can't be used in tests, printing gets as far as opening it.
test('print all pages with the filled-in form', async () => {
  // What would be printed: a checksum of the pixels of each page.
  await userPage.evaluate(() => {
    window.print = () => {
      const images = document.querySelectorAll<HTMLImageElement>('#pdf-studio-print-container img')
      ;(window as unknown as { printed: number[] }).printed = [...images].map((image) => {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        return context
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.reduce((sum, value) => (sum + value) % 1_000_000_007, 0)
      })
      window.dispatchEvent(new Event('afterprint'))
    }
  })
  async function print() {
    await userPage.evaluate(() => delete (window as unknown as { printed?: number[] }).printed)
    await userPage.locator('.pdf-studio-print').click()
    await expect(userPage.locator('.pdf-studio-print')).toBeEnabled()
    return userPage.evaluate(() => (window as unknown as { printed?: number[] }).printed)
  }

  const empty = await print()
  expect(empty).toHaveLength(2)
  await pdfStudio.formField('name').fill('Jane Doe')
  const filled = await print()
  expect(filled).toHaveLength(2)
  expect(filled[0]).not.toBe(empty[0])
  expect(filled[1]).toBe(empty[1])
  await expect(userPage.locator('#pdf-studio-print-container')).toHaveCount(0)
})

test('present the document page by page', async () => {
  const canPresent = await userPage.evaluate(() => document.fullscreenEnabled)
  test.skip(!canPresent, "The browser doesn't allow full screen")
  const container = userPage.locator('.pdf-studio .pdfPresentationMode')
  await userPage.locator('#pdf-studio-more-toggle').click()
  await userPage.locator('.pdf-studio-more-present').click()
  await expect(container).toBeVisible()
  // One page at a time, PDF.js keeps only the one shown.
  const page = (pageNumber: number) =>
    pdfStudio.viewer.locator(`.page[data-page-number="${pageNumber}"]`)
  await expect(page(1)).toBeInViewport()
  await userPage.keyboard.press('ArrowRight')
  await expect(page(2)).toBeInViewport()
  await expect(page(1)).not.toBeInViewport()
  await userPage.evaluate(() => document.exitFullscreen())
  await expect(container).toHaveCount(0)
})

test('highlight text and change its color, like the PDF.js viewer', async () => {
  await userPage.locator('.pdf-studio-tool-highlight').click()
  await pdfStudio.selectText('PDF Studio form')
  await expect(pdfStudio.viewer.locator('.highlightEditor')).toHaveCount(1)
  // PDF.js draws highlights as SVG behind the text.
  const drawing = pdfStudio.viewer.locator('svg.highlight')
  const fill = () => drawing.evaluate((element) => getComputedStyle(element).fill)
  const colorBefore = await fill()
  await userPage.locator('#pdf-studio-highlight-settings-toggle').click()
  await userPage.locator('.pdf-studio-highlight-color .pdf-studio-swatch').nth(1).click()
  await userPage.keyboard.press('Escape')
  await expect.poll(fill).not.toBe(colorBefore)
  const colorChanged = await fill()
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.viewer.locator('.annotationLayer .highlightAnnotation')).toHaveCount(1)
  // With the tool, PDF.js makes saved highlights editable and draws them again.
  await userPage.locator('.pdf-studio-tool-highlight').click()
  await expect.poll(fill).toBe(colorChanged)
})

// Dragging over an empty spot with the highlight tool highlights freely, like the PDF.js viewer.
test('highlight freely where there is no text', async () => {
  await userPage.locator('.pdf-studio-tool-highlight').click()
  await pdfStudio.viewer.locator('.annotationEditorLayer.highlightEditing').first().waitFor()
  const box = await pdfStudio.pages.first().boundingBox()
  // An empty spot below the form fields of the fixture, inside the default viewport.
  const y = box.y + Math.min(box.height * 0.3, 400)
  await userPage.mouse.move(box.x + 100, y)
  await userPage.mouse.down()
  await userPage.mouse.move(box.x + 300, y + 20, { steps: 8 })
  await userPage.mouse.up()
  await expect(pdfStudio.viewer.locator('.highlightEditor.free')).toHaveCount(1)
})

test('undo and redo annotations with the toolbar and the keyboard', async () => {
  await pdfStudio.addText('Undo me')
  const text = pdfStudio.textAnnotation('Undo me')
  await userPage.locator('.pdf-studio-undo').click()
  await expect(text).toHaveCount(0)
  await userPage.locator('.pdf-studio-redo').click()
  await expect(text).toHaveCount(1)
  await pdfStudio.viewer.click({ position: { x: 5, y: 5 } })
  await userPage.keyboard.press('ControlOrMeta+z')
  await expect(text).toHaveCount(0)
  await userPage.keyboard.press('ControlOrMeta+Shift+z')
  await expect(text).toHaveCount(1)
})

// The file counts as unchanged again, like before the annotation.
test('has nothing to save once all annotations are undone', async () => {
  const saveButton = userPage.locator('#app-save-action')
  await pdfStudio.addText('Gone again')
  await expect(saveButton).toBeEnabled()
  await userPage.locator('.pdf-studio-undo').click()
  await expect(saveButton).toBeDisabled()
})

test('undo deleting a page', async () => {
  await pdfStudio.deletePage(2)
  await expect(pdfStudio.pages).toHaveCount(1)
  await userPage.locator('.pdf-studio-undo').click()
  await expect(pdfStudio.pages).toHaveCount(2)
  await userPage.locator('.pdf-studio-redo').click()
  await expect(pdfStudio.pages).toHaveCount(1)
})

test('move a page and save', async () => {
  await expect(pdfStudio.pageText(1)).toContainText('PDF Studio form')
  await pdfStudio.pageAction(1, 'move-page-down')
  await expect(pdfStudio.pageText(1)).toContainText('Second page')
  await pdfStudio.save()
  await pdfStudio.close()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.pageText(1)).toContainText('Second page')
  await expect(pdfStudio.pageText(2)).toContainText('PDF Studio form')
})

test('ask about unsaved changes when closing', async () => {
  await pdfStudio.formField('name').fill('Not saved')
  await pdfStudio.closeBtn.click()
  const modal = userPage.locator('.oc-modal').filter({ hasText: 'Unsaved changes' })
  await modal.locator('.oc-modal-body-actions-cancel').click()
  await expect(pdfStudio.formField('name')).toHaveValue('Not saved')
  await pdfStudio.closeBtn.click()
  await modal.locator('.oc-modal-body-actions-secondary').click()
  await userPage.locator('#files-space-table, #tiles-view').first().waitFor()

  await pdfStudio.open('form.pdf')
  await expect(pdfStudio.formField('name')).toHaveValue('')
})

test('edit and delete a comment', async () => {
  await pdfStudio.selectText('PDF Studio form')
  await pdfStudio.addCommentToSelection('First version')
  await pdfStudio.viewer.locator('.annotationCommentButton').first().click()
  const popup = userPage.locator('.pdf-studio-comment-popup')
  await popup.locator('.pdf-studio-comment-edit').click()
  const modal = userPage.locator('.pdf-studio-comment-modal')
  await modal.locator('textarea').fill('Second version')
  await modal.locator('.oc-modal-body-actions-confirm').click()
  await modal.waitFor({ state: 'detached' })
  await pdfStudio.viewer.locator('.annotationCommentButton').first().click()
  await expect(popup).toContainText('Second version')
  await popup.locator('.pdf-studio-comment-delete').click()
  await expect(popup).toHaveCount(0)
  await userPage.locator('.pdf-studio-tool-comments').click()
  await expect(userPage.locator('#pdf-studio-comments')).toContainText('No comments yet')
  await expect(userPage.locator('.pdf-studio-comment-item')).toHaveCount(0)
})

test('zoom and rotate', async () => {
  const zoom = userPage.locator('.pdf-studio-zoom-label')
  const before = await zoom.textContent()
  await userPage.locator('.pdf-studio-zoom-in').click()
  await expect(zoom).not.toHaveText(before)
  const page = pdfStudio.pages.first()
  const portrait = await page.boundingBox()
  expect(portrait.height).toBeGreaterThan(portrait.width)
  await pdfStudio.moreAction('rotate-cw')
  await expect
    .poll(async () => {
      const box = await page.boundingBox()
      return box.width > box.height
    })
    .toBe(true)
})

// Dragging moves the pages instead of selecting text, like the PDF.js viewer.
test('move the pages with the hand tool', async () => {
  await userPage.locator('.pdf-studio-zoom-in').click()
  await userPage.locator('.pdf-studio-zoom-in').click()
  await pdfStudio.moreAction('hand-tool')
  const container = userPage.locator('.pdf-studio-viewer-container')
  const scrollTop = () => container.evaluate((element) => element.scrollTop)
  const before = await scrollTop()
  const box = await pdfStudio.pages.first().boundingBox()
  await userPage.mouse.move(box.x + 200, box.y + 400)
  await userPage.mouse.down()
  await userPage.mouse.move(box.x + 200, box.y + 200, { steps: 8 })
  await userPage.mouse.up()
  await expect.poll(scrollTop).toBeGreaterThan(before + 100)
})
