import { nextTick, ref, shallowRef } from 'vue'
import { mock } from 'vitest-mock-extended'
import type { EventBus, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfPresentationMode } from '../../../src/composables/usePdfPresentationMode'

vi.mock('pdfjs-dist', () => ({ AnnotationEditorType: { DISABLE: -1, NONE: 0, INK: 15 } }))
vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  ScrollMode: { VERTICAL: 0, PAGE: 3 },
  SpreadMode: { NONE: 0, ODD: 1 }
}))

let unmount: () => void

function setup() {
  Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
  let fullscreenElement: Element | null = null
  Object.defineProperty(document, 'fullscreenElement', {
    get: () => fullscreenElement,
    configurable: true
  })
  const container = document.createElement('div')
  container.requestFullscreen = vi.fn(() => {
    fullscreenElement = container
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  })
  document.body.append(container)
  const viewer = mock<PDFViewer>({
    pagesCount: 14,
    currentPageNumber: 5,
    currentScaleValue: 'auto',
    scrollMode: 0,
    spreadMode: 0,
    annotationEditorMode: 15 as unknown as PDFViewer['annotationEditorMode'],
    nextPage: vi.fn(() => true),
    previousPage: vi.fn(() => true)
  })
  const eventBus = mock<EventBus>()
  let presentation: ReturnType<typeof usePdfPresentationMode>
  const wrapper = getComposableWrapper(() => {
    presentation = usePdfPresentationMode({
      container: ref(container),
      viewer: shallowRef(viewer),
      eventBus
    })
  })
  unmount = () => wrapper.unmount()
  function leaveFullscreen() {
    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
  }
  return { presentation, viewer, eventBus, container, leaveFullscreen }
}

describe('usePdfPresentationMode', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    unmount()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows the pages one by one full screen, without editing', async () => {
    const { presentation, viewer, eventBus } = setup()
    await presentation.request()
    await vi.runOnlyPendingTimersAsync()
    expect(presentation.isActive.value).toBe(true)
    expect(viewer.scrollMode).toBe(3)
    expect(viewer.currentScaleValue).toBe('page-fit')
    expect(viewer.currentPageNumber).toBe(5)
    expect(viewer.annotationEditorMode).toEqual({ mode: 0 })
    expect(eventBus.dispatch).toHaveBeenCalledWith('presentationmodechanged', {
      source: null,
      state: 3
    })
    // PDFViewer fits each page to the screen then.
    expect(viewer.presentationModeState).toBe(3)
  })

  it('turns the page with a click, back with Shift', async () => {
    const { presentation, viewer } = setup()
    await presentation.request()
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0, shiftKey: true }))
    expect(viewer.nextPage).toHaveBeenCalledTimes(1)
    expect(viewer.previousPage).toHaveBeenCalledTimes(1)
  })

  it('restores the view when leaving full screen, on the page shown last', async () => {
    const { presentation, viewer, leaveFullscreen } = setup()
    await presentation.request()
    await vi.runOnlyPendingTimersAsync()
    viewer.currentPageNumber = 9
    leaveFullscreen()
    await vi.runOnlyPendingTimersAsync()
    expect(presentation.isActive.value).toBe(false)
    expect(viewer.scrollMode).toBe(0)
    expect(viewer.currentScaleValue).toBe('auto')
    expect(viewer.currentPageNumber).toBe(9)
    expect(viewer.annotationEditorMode).toEqual({ mode: 15 })
  })

  it('only closes the context menu with the first click after it', async () => {
    const { presentation, viewer } = setup()
    await presentation.request()
    window.dispatchEvent(new MouseEvent('contextmenu'))
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect(viewer.nextPage).not.toHaveBeenCalled()
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect(viewer.nextPage).toHaveBeenCalledTimes(1)
  })

  it('does not turn pages when not presenting', () => {
    const { viewer } = setup()
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect(viewer.nextPage).not.toHaveBeenCalled()
  })

  it('only takes the wheel while presenting', async () => {
    const { presentation, viewer, leaveFullscreen } = setup()
    const wheel = () => new WheelEvent('wheel', { deltaY: 100, cancelable: true })
    const before = wheel()
    window.dispatchEvent(before)
    expect(before.defaultPrevented).toBe(false)
    await presentation.request()
    window.dispatchEvent(wheel())
    expect(viewer.nextPage).toHaveBeenCalledTimes(1)
    leaveFullscreen()
    await nextTick()
    const after = wheel()
    window.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
  })
})
