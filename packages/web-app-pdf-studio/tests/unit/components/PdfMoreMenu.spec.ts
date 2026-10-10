import { ref } from 'vue'
import { defaultPlugins, mount, ocDropStub } from '@opencloud-eu/web-test-helpers'
import PdfMoreMenu from '../../../src/components/PdfMoreMenu.vue'

vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  ScrollMode: { VERTICAL: 0, HORIZONTAL: 1, WRAPPED: 2, PAGE: 3 },
  SpreadMode: { NONE: 0, ODD: 1, EVEN: 2 }
}))

const screen = { isMobile: ref(false), isTablet: ref(false) }
vi.mock('@opencloud-eu/design-system/composables', () => ({ useIsMobile: () => screen }))

function createWrapper(
  props: Partial<InstanceType<typeof PdfMoreMenu>['$props']> = {},
  { attachTo }: { attachTo?: HTMLElement } = {}
) {
  return mount(PdfMoreMenu, {
    props: { scrollMode: 0, spreadMode: 0, ...props },
    attachTo,
    global: {
      plugins: [...defaultPlugins()],
      stubs: { 'oc-icon': true, 'oc-drop': ocDropStub }
    }
  })
}

function itemIds(wrapper: ReturnType<typeof createWrapper>) {
  return wrapper
    .findAll('button[class*="pdf-studio-more-"]')
    .map((button) => button.classes().find((name) => name.startsWith('pdf-studio-more-')))
}

describe('PdfMoreMenu', () => {
  afterEach(() => {
    screen.isMobile.value = false
    screen.isTablet.value = false
  })

  it('offers what the toolbar of wide screens has no room for, like the PDF.js viewer', () => {
    expect(itemIds(createWrapper({ canAnnotate: true, canPresent: true }))).toEqual([
      'pdf-studio-more-present',
      'pdf-studio-more-first-page',
      'pdf-studio-more-last-page',
      'pdf-studio-more-rotate-cw',
      'pdf-studio-more-rotate-ccw',
      'pdf-studio-more-text-selection',
      'pdf-studio-more-hand-tool',
      'pdf-studio-more-properties'
    ])
  })

  it('also offers print, undo and redo on tablets, zoom only on phones', () => {
    screen.isTablet.value = true
    const ids = itemIds(createWrapper({ canAnnotate: true, canPresent: true }))
    for (const id of ['print', 'undo', 'redo', 'present', 'hand-tool']) {
      expect(ids).toContain(`pdf-studio-more-${id}`)
    }
    expect(ids).not.toContain('pdf-studio-more-zoom-in')
  })

  it('offers no presentation mode and hand tool on phones', () => {
    screen.isMobile.value = true
    screen.isTablet.value = true
    const ids = itemIds(createWrapper({ canAnnotate: true, canPresent: true }))
    expect(ids).not.toContain('pdf-studio-more-present')
    expect(ids).not.toContain('pdf-studio-more-hand-tool')
    expect(ids).toContain('pdf-studio-more-zoom-in')
  })

  it('offers undo and redo only where the document can be edited', () => {
    screen.isTablet.value = true
    expect(createWrapper().find('.pdf-studio-more-undo').exists()).toBe(false)
    const wrapper = createWrapper({ canAnnotate: true, canUndo: true })
    expect(wrapper.find('.pdf-studio-more-undo').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.pdf-studio-more-redo').attributes('disabled')).toBeDefined()
  })

  it.each([
    ['zoom-in', 'zoomIn'],
    ['zoom-out', 'zoomOut']
  ])('emits %s on phones', async (id, event) => {
    screen.isMobile.value = true
    screen.isTablet.value = true
    const wrapper = createWrapper()
    await wrapper.find(`.pdf-studio-more-${id}`).trigger('click')
    expect(wrapper.emitted(event)).toEqual([[]])
  })

  it.each([
    ['print', 'print', []],
    ['present', 'present', []],
    ['first-page', 'firstPage', []],
    ['last-page', 'lastPage', []],
    ['rotate-cw', 'rotate', [90]],
    ['rotate-ccw', 'rotate', [-90]],
    ['text-selection', 'setHandTool', [false]],
    ['hand-tool', 'setHandTool', [true]],
    ['properties', 'showProperties', []]
  ])('emits %s', async (id, event, args) => {
    screen.isTablet.value = true
    const wrapper = createWrapper({ canPresent: true })
    await wrapper.find(`.pdf-studio-more-${id}`).trigger('click')
    expect(wrapper.emitted(event)).toEqual([args])
  })

  it('disables what goes nowhere, like the PDF.js viewer', () => {
    screen.isMobile.value = true
    screen.isTablet.value = true
    const wrapper = createWrapper({
      canZoomIn: false,
      canZoomOut: false,
      isFirstPage: true,
      isLastPage: true
    })
    for (const id of ['zoom-in', 'zoom-out', 'first-page', 'last-page']) {
      expect(wrapper.find(`.pdf-studio-more-${id}`).attributes('disabled')).toBeDefined()
    }
  })

  // The dialog returns the focus to where it was, the menu item is gone then.
  it('moves the focus to its toggle before showing the document properties', async () => {
    const wrapper = createWrapper({}, { attachTo: document.body })
    await wrapper.find('.pdf-studio-more-properties').trigger('click')
    expect(document.activeElement).toBe(wrapper.find('.pdf-studio-more').element)
    wrapper.unmount()
  })

  it('marks the active cursor tool', () => {
    const wrapper = createWrapper({ isHandToolActive: true })
    expect(wrapper.find('.pdf-studio-more-hand-tool').attributes('aria-current')).toBe('true')
    expect(
      wrapper.find('.pdf-studio-more-text-selection').attributes('aria-current')
    ).toBeUndefined()
  })

  it('pauses text selection and hand tool while annotating, like the PDF.js viewer', () => {
    const wrapper = createWrapper({ isToolActive: true })
    expect(wrapper.find('.pdf-studio-more-text-selection').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.pdf-studio-more-hand-tool').attributes('disabled')).toBeDefined()
  })

  it('offers the page layout', async () => {
    const wrapper = createWrapper({ spreadMode: 1 })
    expect(wrapper.find('.pdf-studio-spread-option[aria-current="true"]').text()).toBe(
      'Odd spreads'
    )
    await wrapper.find('.pdf-studio-scroll-option[data-mode="2"]').trigger('click')
    expect(wrapper.emitted('setScrollMode')).toEqual([[2]])
  })
})
