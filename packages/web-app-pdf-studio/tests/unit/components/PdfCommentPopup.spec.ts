import { flushPromises } from '@vue/test-utils'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import PdfCommentPopup from '../../../src/components/PdfCommentPopup.vue'
import type { CommentPopup } from '../../../src/composables/usePdfComments'

vi.mock('@opencloud-eu/web-pkg', () => ({
  formatDateFromJSDate: () => 'January 1, 2026'
}))
vi.mock('pdfjs-dist', () => ({
  PDFDateString: { toDateObject: () => new Date(2026, 0, 1) },
  renderRichText: ({ html }: { html: string }, element: HTMLElement) => {
    element.textContent = html
  }
}))

function createWrapper({ isSelected = true, isEditable = true } = {}) {
  const parent = document.createElement('div')
  parent.className = 'page'
  const button = document.createElement('button')
  parent.append(button)
  document.body.append(parent)
  const popup = {
    target: {
      comment: 'Hi',
      elementBeforePopup: button,
      commentPopupPosition: [0.9, 0.2],
      commentButtonWidth: 0.02,
      parentBoundingClientRect: new DOMRect(0, 0, 1000, 1000),
      getData: vi.fn(),
      hasDefaultPopupPosition: () => true,
      setCommentButtonStates: vi.fn(),
      editComment: vi.fn(),
      focusCommentButton: vi.fn()
    },
    data: { id: 'a', pageIndex: 0, rect: [], color: [255, 0, 0], contentsObj: { str: 'Hi there' } },
    isSelected,
    isEditable
  } as unknown as CommentPopup
  const wrapper = mount(PdfCommentPopup, {
    props: { popup },
    global: { plugins: [...defaultPlugins()], stubs: { 'oc-icon': true } },
    attachTo: document.body
  })
  return { wrapper, parent }
}

describe('PdfCommentPopup', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows date and text next to the comment button', async () => {
    const { parent } = createWrapper()
    await flushPromises()
    const popup = parent.querySelector('.pdf-studio-comment-popup') as HTMLElement
    expect(popup.textContent).toContain('January 1, 2026')
    expect(popup.textContent).toContain('Hi there')
    // Moved left of the button, there is no room on the right of the page.
    expect(parseFloat(popup.style.left)).toBeLessThan(90)
    expect(
      (popup.querySelector('[style*="background-color"]') as HTMLElement).style.backgroundColor
    ).toBe('rgb(255, 0, 0)')
  })

  it.each([
    [true, true, true],
    [false, true, false],
    [true, false, false]
  ])('offers edit and delete (selected: %s, editable: %s)', (isSelected, isEditable, shown) => {
    const { parent } = createWrapper({ isSelected, isEditable })
    expect(!!parent.querySelector('.pdf-studio-comment-edit')).toBe(shown)
    expect(!!parent.querySelector('.pdf-studio-comment-delete')).toBe(shown)
  })

  it.each([
    [true, 1],
    [false, 0]
  ])(
    'closes on clicks elsewhere if opened by clicking (selected: %s)',
    async (isSelected, count) => {
      const { wrapper } = createWrapper({ isSelected })
      await flushPromises()
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      document.body.dispatchEvent(new PointerEvent('click', { bubbles: true }))
      expect(wrapper.emitted('dismiss') ?? []).toHaveLength(count)
    }
  )

  it('emits edit, delete and close', async () => {
    const { wrapper, parent } = createWrapper()
    ;(parent.querySelector('.pdf-studio-comment-edit') as HTMLElement).click()
    ;(parent.querySelector('.pdf-studio-comment-delete') as HTMLElement).click()
    parent
      .querySelector('.pdf-studio-comment-popup')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('edit')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
