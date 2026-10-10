import { defaultPlugins, mount, ocDropStub } from '@opencloud-eu/web-test-helpers'
import { AnnotationEditorParamsType, AnnotationEditorType } from 'pdfjs-dist'
import PdfAnnotationTools from '../../../src/components/PdfAnnotationTools.vue'

function createWrapper({
  editorMode = AnnotationEditorType.NONE,
  disabled = false,
  params = undefined as Map<number, unknown> | undefined,
  isPublicLink = false
} = {}) {
  return mount(PdfAnnotationTools, {
    props: {
      editorMode,
      disabled,
      params
    },
    global: {
      plugins: [
        ...defaultPlugins({
          piniaOptions: { authState: { publicLinkContextReady: isPublicLink } }
        })
      ],
      stubs: { 'oc-icon': true, 'oc-drop': ocDropStub }
    }
  })
}

describe('PdfAnnotationTools', () => {
  it.each([
    ['comments', AnnotationEditorType.POPUP],
    ['highlight', AnnotationEditorType.HIGHLIGHT],
    ['freetext', AnnotationEditorType.FREETEXT],
    ['ink', AnnotationEditorType.INK],
    ['signature', AnnotationEditorType.SIGNATURE]
  ])('selects the %s tool', async (id, mode) => {
    const wrapper = createWrapper()
    await wrapper.find(`.pdf-studio-tool-${id}`).trigger('click')
    expect(wrapper.emitted('selectTool')).toEqual([[mode]])
  })

  it('marks the active tool', () => {
    const wrapper = createWrapper({ editorMode: AnnotationEditorType.INK })
    expect(wrapper.find('.pdf-studio-tool-ink').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.pdf-studio-tool-highlight').attributes('aria-pressed')).toBe('false')
  })

  // Like in the PDF.js viewer, where the settings show with the active tool.
  it('offers the settings of the active tool only', () => {
    const wrapper = createWrapper({ editorMode: AnnotationEditorType.INK })
    expect(wrapper.find('#pdf-studio-ink-settings-toggle').attributes('disabled')).toBeUndefined()
    expect(
      wrapper.find('#pdf-studio-highlight-settings-toggle').attributes('disabled')
    ).toBeDefined()
    expect(
      wrapper.find('#pdf-studio-freetext-settings-toggle').attributes('disabled')
    ).toBeDefined()
  })

  it('disables all tools until PDF.js is ready', () => {
    const wrapper = createWrapper({ disabled: true })
    for (const selector of [
      '.pdf-studio-tool-highlight',
      '.pdf-studio-tool-ink',
      '.pdf-studio-tool-stamp'
    ]) {
      expect(wrapper.find(selector).attributes('disabled')).toBeDefined()
    }
  })

  it.each([
    ['.pdf-studio-ink-thickness input', '5', AnnotationEditorParamsType.INK_THICKNESS, 5],
    ['.pdf-studio-ink-opacity input', '0.5', AnnotationEditorParamsType.INK_OPACITY, 0.5],
    ['.pdf-studio-freetext-size input', '20', AnnotationEditorParamsType.FREETEXT_SIZE, 20],
    [
      '.pdf-studio-highlight-thickness input',
      '16',
      AnnotationEditorParamsType.HIGHLIGHT_THICKNESS,
      16
    ]
  ])('updates the tool setting %s, for its tool', async (selector, value, type, expected) => {
    const wrapper = createWrapper()
    const input = wrapper.find(selector)
    ;(input.element as HTMLInputElement).value = value
    await input.trigger('input')
    const [[mode, ...param]] = wrapper.emitted('updateParam')
    expect(param).toEqual([type, expected])
    expect(mode).toBe(
      selector.includes('ink')
        ? AnnotationEditorType.INK
        : selector.includes('freetext')
          ? AnnotationEditorType.FREETEXT
          : AnnotationEditorType.HIGHLIGHT
    )
  })

  it('updates the highlight color', async () => {
    const wrapper = createWrapper()
    await wrapper.findAll('.pdf-studio-highlight-color .pdf-studio-swatch')[2].trigger('click')
    expect(wrapper.emitted('updateParam')).toEqual([
      [AnnotationEditorType.HIGHLIGHT, AnnotationEditorParamsType.HIGHLIGHT_COLOR, '#80EBFF']
    ])
  })

  it('shows the settings PDF.js reports, its defaults until then', () => {
    const wrapper = createWrapper({
      params: new Map([[AnnotationEditorParamsType.INK_THICKNESS, 7]])
    })
    expect(
      (wrapper.find('.pdf-studio-ink-thickness input').element as HTMLInputElement).value
    ).toBe('7')
    expect((wrapper.find('.pdf-studio-ink-opacity input').element as HTMLInputElement).value).toBe(
      '1'
    )
  })

  // Like in the PDF.js viewer.
  it('disables the thickness for highlights of text, only free highlights have one', () => {
    const thickness = (params?: Map<number, unknown>) =>
      createWrapper({ params }).find('.pdf-studio-highlight-thickness input').attributes('disabled')
    expect(thickness()).toBeUndefined()
    expect(thickness(new Map([[AnnotationEditorParamsType.HIGHLIGHT_FREE, false]]))).toBeDefined()
  })

  it('shows or hides all highlights', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.pdf-studio-highlight-show-all .oc-switch-btn').trigger('click')
    expect(wrapper.emitted('updateParam')).toEqual([
      [AnnotationEditorType.HIGHLIGHT, AnnotationEditorParamsType.HIGHLIGHT_SHOW_ALL, false]
    ])
  })

  it.each(['device', 'cloud'])('adds images from the %s', async (source) => {
    const wrapper = createWrapper()
    await wrapper.find(`.pdf-studio-add-image-${source}`).trigger('click')
    expect(wrapper.emitted('addImage')).toEqual([[source]])
  })

  it('offers no images from the cloud on public links, there is nothing to pick from', () => {
    const wrapper = createWrapper({ isPublicLink: true })
    expect(wrapper.find('.pdf-studio-add-image-device').exists()).toBe(true)
    expect(wrapper.find('.pdf-studio-add-image-cloud').exists()).toBe(false)
  })

  it('lists the tools in the order signature, highlight, text, draw, image, comments', () => {
    const order = createWrapper()
      .findAll('.pdf-studio-tool')
      .map((tool) =>
        tool
          .classes()
          .find((name) => name.startsWith('pdf-studio-tool-'))
          .replace('pdf-studio-tool-', '')
      )
    expect(order).toEqual(['signature', 'highlight', 'freetext', 'ink', 'stamp', 'comments'])
  })
})
