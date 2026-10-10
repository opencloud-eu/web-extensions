import { mock } from 'vitest-mock-extended'
import { AnnotationEditorUIManager, AnnotationLayer } from 'pdfjs-dist'
import { EventBus, type PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import {
  getAnnotationPopup,
  getEditorUiManager,
  getImageBitmap,
  isCreatingSignature,
  isDrawing
} from '../../../src/helpers/pdfjsInternals'

// Against PDF.js itself: these tests fail when an update changes what the app relies on.
describe('PDF.js', () => {
  // PDF.js uses it, browsers have it, Node doesn't yet.
  type ComputedMap = Map<unknown, unknown> & {
    getOrInsertComputed?: (key: unknown, compute: (key: unknown) => unknown) => unknown
  }
  const mapPrototype = Map.prototype as ComputedMap
  const hasGetOrInsertComputed = !!mapPrototype.getOrInsertComputed
  beforeAll(() => {
    mapPrototype.getOrInsertComputed ??= function (this: ComputedMap, key, compute) {
      if (!this.has(key)) {
        this.set(key, compute(key))
      }
      return this.get(key)
    }
  })
  afterAll(() => {
    if (!hasGetOrInsertComputed) {
      delete mapPrototype.getOrInsertComputed
    }
  })

  const managers: AnnotationEditorUIManager[] = []
  afterEach(() => managers.splice(0).forEach((manager) => manager.destroy()))

  function createUiManager() {
    const eventBus = new EventBus()
    const viewer = document.createElement('div')
    const UiManager = AnnotationEditorUIManager as unknown as new (
      ...args: unknown[]
    ) => AnnotationEditorUIManager
    const uiManager = new UiManager(
      document.createElement('div'),
      viewer,
      null,
      null,
      null,
      null,
      eventBus,
      { annotationStorage: {}, filterFactory: {} }
    )
    managers.push(uiManager)
    return { uiManager, eventBus, viewer }
  }

  it("changes the uiManager's settings with the event of the viewer's toolbars", () => {
    const { uiManager, eventBus } = createUiManager()
    const updateParams = vi.spyOn(uiManager, 'updateParams')
    eventBus.dispatch('switchannotationeditorparams', { source: null, type: 22, value: 5 })
    expect(updateParams).toHaveBeenCalledWith(22, 5)
  })

  it.each(['undo', 'redo'] as const)('does "%s" on the editing action event', (name) => {
    const { uiManager, eventBus } = createUiManager()
    const action = vi.spyOn(uiManager, name).mockImplementation(() => {})
    eventBus.dispatch('editingaction', { source: null, name })
    expect(action).toHaveBeenCalled()
  })

  it('marks the viewer while drawing', () => {
    const { uiManager, viewer } = createUiManager()
    const pdfViewer = mock<PDFViewer>()
    Object.defineProperty(pdfViewer, 'viewer', { value: viewer })
    uiManager.disableUserSelect(true)
    expect(isDrawing(pdfViewer)).toBe(true)
    uiManager.disableUserSelect(false)
    expect(isDrawing(pdfViewer)).toBe(false)
  })

  it('reads image files', () => {
    const { uiManager } = createUiManager()
    expect(uiManager.imageManager.getFromFile).toBeTypeOf('function')
  })

  it('finds the editable annotations of a page', () => {
    expect(AnnotationLayer.prototype.getEditableAnnotation).toBeTypeOf('function')
  })
})

describe('pdfjsInternals', () => {
  it('knows about a new signature waiting for its dialog, hidden until then', () => {
    const pdfViewer = mock<PDFViewer>()
    Object.defineProperty(pdfViewer, 'viewer', { value: document.createElement('div') })
    expect(isCreatingSignature(pdfViewer)).toBe(false)
    const signature = document.createElement('div')
    signature.className = 'signatureEditor'
    signature.hidden = true
    pdfViewer.viewer.append(signature)
    expect(isCreatingSignature(pdfViewer)).toBe(true)
  })

  it("knows the uiManager of editors, not of annotations PDF.js can't edit", () => {
    const uiManager = mock<AnnotationEditorUIManager>()
    expect(getEditorUiManager({ _uiManager: uiManager })).toBe(uiManager)
    expect(getEditorUiManager({ _uiManager: null })).toBeUndefined()
    expect(getEditorUiManager({})).toBeUndefined()
  })

  it('reads image files, null if they are no images', async () => {
    const bitmap = {} as ImageBitmap
    const getFromFile = vi.fn().mockResolvedValueOnce({ bitmap }).mockResolvedValueOnce(null)
    const uiManager = mock<AnnotationEditorUIManager>({ imageManager: { getFromFile } })
    const file = new File([], 'a.png')
    expect(await getImageBitmap(uiManager, file)).toBe(bitmap)
    expect(await getImageBitmap(uiManager, file)).toBeNull()
  })

  it('finds the comment popup of a saved annotation once its page is rendered', () => {
    const popup = {}
    const getEditableAnnotation = vi.fn().mockReturnValue({ popup })
    const viewer = mock<PDFViewer>({
      getPageView: vi.fn((pageIndex: number) =>
        pageIndex === 0 ? { annotationLayer: { annotationLayer: { getEditableAnnotation } } } : {}
      )
    })
    expect(getAnnotationPopup(viewer, 0, '12R')).toBe(popup)
    expect(getEditableAnnotation).toHaveBeenCalledWith('12R')
    expect(getAnnotationPopup(viewer, 1, '12R')).toBeUndefined()
  })
})
