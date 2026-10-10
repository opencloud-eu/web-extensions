import { nextTick, ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { AnnotationEditorParamsType, AnnotationEditorType } from 'pdfjs-dist'
import { ScrollMode, SpreadMode } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import PdfToolbar from '../../../src/components/PdfToolbar.vue'

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useResizeObserver: vi.fn()
}))

const screen = { isMobile: ref(false), isTablet: ref(false) }
vi.mock('@opencloud-eu/design-system/composables', () => ({ useIsMobile: () => screen }))

type Props = InstanceType<typeof PdfToolbar>['$props']

function createWrapper(props: Partial<Props> = {}) {
  return mount(PdfToolbar, {
    props: {
      pageNumber: 2,
      pagesCount: 5,
      scaleValue: 'auto',
      scale: 1,
      scrollMode: ScrollMode.VERTICAL,
      spreadMode: SpreadMode.NONE,
      editorMode: AnnotationEditorType.NONE,
      canAnnotate: true,
      editingStates: {
        hasSomethingToUndo: true,
        hasSomethingToRedo: false,
        hasSelectedEditor: false
      },
      ...props
    },
    global: { plugins: [...defaultPlugins()], stubs: { 'oc-icon': true } }
  })
}

describe('PdfToolbar', () => {
  afterEach(() => {
    screen.isMobile.value = false
    screen.isTablet.value = false
  })

  it('has everything at hand on wide screens, the rest in the "More actions" menu', () => {
    const wrapper = createWrapper()
    for (const selector of [
      '.pdf-studio-undo',
      '.pdf-studio-zoom',
      '.pdf-studio-next-page',
      '.pdf-studio-print'
    ]) {
      expect(wrapper.find(selector).exists()).toBe(true)
    }
    expect(wrapper.findComponent({ name: 'PdfAnnotationTools' }).exists()).toBe(true)
    expect(wrapper.find('.pdf-studio-more').exists()).toBe(true)
  })

  // Zooming in and out stays, like in the PDF.js viewer.
  it('moves undo, page buttons and print into the menu on tablets', () => {
    screen.isTablet.value = true
    const wrapper = createWrapper()
    expect(wrapper.find('.pdf-studio-zoom-in').exists()).toBe(true)
    expect(wrapper.find('.pdf-studio-zoom').exists()).toBe(true)
    for (const selector of ['.pdf-studio-undo', '.pdf-studio-next-page', '.pdf-studio-print']) {
      expect(wrapper.find(selector).exists()).toBe(false)
    }
    expect(wrapper.findComponent({ name: 'PdfAnnotationTools' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PdfToolPicker' }).exists()).toBe(false)
  })

  it('offers the annotation tools in a picker on phones', () => {
    screen.isMobile.value = true
    screen.isTablet.value = true
    const wrapper = createWrapper()
    expect(wrapper.findComponent({ name: 'PdfAnnotationTools' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'PdfToolPicker' }).exists()).toBe(true)
    // Pinching zooms, the buttons are in the menu.
    expect(wrapper.find('.pdf-studio-zoom-in').exists()).toBe(false)
  })

  it('shows the current page and page count', () => {
    const wrapper = createWrapper()
    expect((wrapper.find('.pdf-studio-page-number input').element as HTMLInputElement).value).toBe(
      '2'
    )
    expect(wrapper.find('.pdf-studio-pages-count').text()).toBe('of 5')
  })

  it('navigates to the previous and next page', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.pdf-studio-previous-page').trigger('click')
    await wrapper.find('.pdf-studio-next-page').trigger('click')
    // PDF.js steps by spread when pages are side by side.
    expect(wrapper.emitted('previousPage')).toHaveLength(1)
    expect(wrapper.emitted('nextPage')).toHaveLength(1)
  })

  it.each([
    [1, '.pdf-studio-previous-page'],
    [5, '.pdf-studio-next-page']
  ])('disables page navigation beyond the document on page %i', (pageNumber, selector) => {
    const wrapper = createWrapper({ pageNumber })
    expect(wrapper.find(selector).attributes('disabled')).toBeDefined()
  })

  it('navigates to an entered page number', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.pdf-studio-page-number input').setValue('4')
    expect(wrapper.emitted('goToPage')).toEqual([[4]])
  })

  it.each(['0', '6', 'abc'])('resets an invalid page number "%s"', async (value) => {
    const wrapper = createWrapper()
    const input = wrapper.find('.pdf-studio-page-number input')
    await input.setValue(value)
    expect(wrapper.emitted('goToPage')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('2')
  })

  it.each([
    ['.pdf-studio-toggle-sidebar', 'toggleSidebar', []],
    ['.pdf-studio-toggle-find', 'toggleFindBar', []],
    ['.pdf-studio-zoom-out', 'zoomOut', []],
    ['.pdf-studio-zoom-in', 'zoomIn', []],
    ['.pdf-studio-print', 'print', []],
    ['.pdf-studio-undo', 'undo', []]
  ])('clicking %s emits %s', async (selector, event, args) => {
    const wrapper = createWrapper()
    await wrapper.find(selector).trigger('click')
    expect(wrapper.emitted(event)).toEqual([args])
  })

  it('disables redo when there is nothing to redo', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.pdf-studio-redo').attributes('disabled')).toBeDefined()
  })

  it('relays zoom and annotation events', () => {
    const wrapper = createWrapper()
    const zoom = wrapper.findComponent({ name: 'PdfZoomMenu' })
    zoom.vm.$emit('setScale', 'page-fit')
    const tools = wrapper.findComponent({ name: 'PdfAnnotationTools' })
    tools.vm.$emit('selectTool', AnnotationEditorType.INK)
    tools.vm.$emit(
      'updateParam',
      AnnotationEditorType.INK,
      AnnotationEditorParamsType.INK_COLOR,
      '#ff0000'
    )
    tools.vm.$emit('addImage', 'cloud')
    expect(wrapper.emitted('setScale')).toEqual([['page-fit']])
    expect(wrapper.emitted('selectTool')).toEqual([[AnnotationEditorType.INK]])
    expect(wrapper.emitted('updateParam')).toEqual([
      [AnnotationEditorType.INK, AnnotationEditorParamsType.INK_COLOR, '#ff0000']
    ])
    expect(wrapper.emitted('addImage')).toEqual([['cloud']])
  })

  it.each([
    [0.1, '.pdf-studio-zoom-out'],
    [25, '.pdf-studio-zoom-in']
  ])('disables zooming beyond the limit at %f, like the PDF.js viewer', (scale, selector) => {
    const wrapper = createWrapper({ scale })
    expect(wrapper.find(selector).attributes('disabled')).toBeDefined()
  })

  describe('separators between the groups', () => {
    // Positions of the groups after wrapping into rows.
    function layOut(groups: Element[], rows: [top: number, height: number][]) {
      groups.forEach((group, i) => {
        Object.defineProperty(group, 'offsetTop', { value: rows[i][0], configurable: true })
        Object.defineProperty(group, 'offsetHeight', { value: rows[i][1], configurable: true })
      })
    }

    async function setup() {
      const wrapper = createWrapper()
      await nextTick()
      const [, onResize] = vi.mocked(useResizeObserver).mock.lastCall
      const groups = [...wrapper.find('.pdf-studio-toolbar-items').element.children]
      return { groups, onResize: onResize as () => void }
    }

    it('leaves out the separator at the start of a row', async () => {
      const { groups, onResize } = await setup()
      // Centered within their row: the second row starts below the bottom of the first one.
      layOut(groups, [
        [0, 32],
        [2, 28],
        [0, 32],
        [34, 32],
        [36, 28],
        [34, 32]
      ])
      onResize()
      expect(groups.map((group) => group.hasAttribute('data-row-start'))).toEqual([
        false,
        false,
        false,
        true,
        false,
        false
      ])
    })
  })

  it('hides annotating where it is not possible (read-only files, XFA forms)', () => {
    const wrapper = createWrapper({ canAnnotate: false })
    expect(wrapper.findComponent({ name: 'PdfAnnotationTools' }).exists()).toBe(false)
    expect(wrapper.find('.pdf-studio-undo').exists()).toBe(false)
  })
})
