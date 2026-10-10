import { mock } from 'vitest-mock-extended'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfViewer } from '../../../src/composables/usePdfViewer'

const { calls } = vi.hoisted(() => ({ calls: [] as [string, unknown][] }))

vi.mock('pdfjs-dist', () => ({
  AnnotationEditorType: { DISABLE: -1, NONE: 0, INK: 15 },
  AnnotationMode: { ENABLE: 1, ENABLE_FORMS: 2 }
}))
vi.mock('../../../src/helpers/pdfjs', () => ({ createScripting: vi.fn(), pdfjsAssetUrls: {} }))
vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => {
  class EventBus {
    listeners = new Map<string, ((evt: unknown) => void)[]>()
    on(name: string, listener: (evt: unknown) => void) {
      this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener])
    }
    dispatch(name: string, evt: unknown) {
      this.listeners.get(name)?.forEach((listener) => listener(evt))
    }
  }
  // Records what the viewer gets set, in order.
  class PDFViewer {
    pagesCount = 3
    currentPageNumber = 1
    setDocument = vi.fn()
    set scrollMode(value: unknown) {
      calls.push(['scrollMode', value])
    }
    set spreadMode(value: unknown) {
      calls.push(['spreadMode', value])
    }
    set pagesRotation(value: unknown) {
      calls.push(['pagesRotation', value])
    }
    // "auto" zoom depends on the orientation of the current page.
    set currentScaleValue(value: unknown) {
      calls.push(['currentScaleValue', { value, pageNumber: this.currentPageNumber }])
    }
    set annotationEditorMode(value: unknown) {
      calls.push(['annotationEditorMode', value])
    }
  }
  return {
    EventBus,
    PDFViewer,
    DownloadManager: class {},
    LinkTarget: { BLANK: 2 },
    PDFFindController: class {},
    PDFLinkService: class {
      setViewer() {}
      setDocument() {}
    },
    PDFScriptingManager: class {
      setViewer() {}
    },
    ScrollMode: { VERTICAL: 0 },
    SpreadMode: { NONE: 0 }
  }
})

function setup() {
  calls.length = 0
  let viewer: ReturnType<typeof usePdfViewer>
  getComposableWrapper(() => {
    viewer = usePdfViewer({
      container: document.createElement('div'),
      viewerAlert: null,
      isReadOnly: false,
      altTextManager: {},
      signatureManager: {},
      commentManager: {}
    })
  })
  return { viewer }
}

describe('usePdfViewer', () => {
  it('shows the page of a new document before applying the zoom', () => {
    const { viewer } = setup()
    viewer.setDocument(mock<PDFDocumentProxy>(), { pageNumber: 2 })
    viewer.eventBus.dispatch('pagesinit', { source: null })
    expect(calls).toContainEqual(['currentScaleValue', { value: 'auto', pageNumber: 2 }])
    expect(viewer.pageNumber.value).toBe(2)
  })

  // Until then PDF.js gives all pages the size of the first one, like the PDF.js viewer waits.
  it('applies the zoom again once all pages are loaded', () => {
    const { viewer } = setup()
    viewer.setDocument(mock<PDFDocumentProxy>(), { pageNumber: 2 })
    viewer.eventBus.dispatch('pagesinit', { source: null })
    calls.length = 0
    viewer.eventBus.dispatch('pagesloaded', { source: null, pagesCount: 3 })
    expect(calls).toEqual([['currentScaleValue', { value: 'auto', pageNumber: 2 }]])
  })

  it('keeps the active tool for a rebuilt document', () => {
    const { viewer } = setup()
    viewer.setDocument(mock<PDFDocumentProxy>())
    viewer.eventBus.dispatch('annotationeditoruimanager', { uiManager: {} })
    viewer.eventBus.dispatch('annotationeditormodechanged', { mode: 15 })
    viewer.eventBus.dispatch('pagesinit', { source: null })
    expect(calls).not.toContainEqual(['annotationEditorMode', expect.anything()])

    viewer.setDocument(mock<PDFDocumentProxy>())
    expect(viewer.editorMode.value).toBe(0)
    viewer.eventBus.dispatch('annotationeditoruimanager', { uiManager: {} })
    viewer.eventBus.dispatch('pagesinit', { source: null })
    expect(calls).toContainEqual(['annotationEditorMode', { mode: 15 }])
  })
})
