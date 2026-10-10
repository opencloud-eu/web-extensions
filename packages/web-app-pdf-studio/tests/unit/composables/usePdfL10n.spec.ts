import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfL10n } from '../../../src/composables/usePdfL10n'

function setup() {
  let l10n: ReturnType<typeof usePdfL10n>['l10n']
  getComposableWrapper(() => {
    l10n = usePdfL10n().l10n
  })
  return l10n
}

function createElement(id: string, args?: object) {
  const element = document.createElement('div')
  element.setAttribute('data-l10n-id', id)
  if (args) {
    element.setAttribute('data-l10n-args', JSON.stringify(args))
  }
  return element
}

describe('usePdfL10n', () => {
  it('translates the texts and attributes PDF.js marks', async () => {
    const l10n = setup()
    const root = document.createElement('div')
    root.append(
      createElement('pdfjs-page-landmark', { page: 3 }),
      createElement('pdfjs-free-text2'),
      createElement('pdfjs-highlight-floating-button-label')
    )
    await l10n.translate(root)
    const [page, freeText, label] = root.children
    expect(page.getAttribute('aria-label')).toBe('Page 3')
    expect(freeText.getAttribute('default-content')).toBe('Start typing…')
    expect(label.textContent).toBe('Highlight')
  })

  it('translates what PDF.js adds or changes later', async () => {
    const l10n = setup()
    const root = document.createElement('div')
    await l10n.translate(root)
    const remove = createElement('pdfjs-editor-remove-ink-button')
    root.append(remove)
    const alert = createElement('pdfjs-editor-ink-added-alert')
    root.append(alert)
    alert.setAttribute('data-l10n-id', 'pdfjs-editor-stamp-added-alert')
    await vi.waitFor(() => expect(alert.textContent).toBe('Image added'))
    expect(remove.getAttribute('title')).toBe('Remove drawing')
  })

  it('leaves unknown texts to PDF.js', async () => {
    const l10n = setup()
    const element = createElement('pdfjs-unknown')
    element.textContent = 'English'
    await l10n.translateOnce(element)
    expect(element.textContent).toBe('English')
    expect(await l10n.get('pdfjs-unknown')).toBeUndefined()
  })

  it('formats texts with arguments', async () => {
    const l10n = setup()
    const element = createElement('pdfjs-editor-signature-editor1', { description: 'Jane & Co' })
    await l10n.translateOnce(element)
    expect(element.getAttribute('aria-description')).toBe('Signature editor: Jane & Co')
  })
})
