import { nextTick, ref, shallowRef, unref } from 'vue'
import { mock } from 'vitest-mock-extended'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import {
  getMovedPageIndices,
  usePdfPageOperations
} from '../../../src/composables/usePdfPageOperations'
import { loadPdfDocument } from '../../../src/helpers/pdfjs'
import { useMessages } from '@opencloud-eu/web-pkg'

vi.mock('../../../src/helpers/pdfjs', () => ({ loadPdfDocument: vi.fn() }))
vi.mock('@opencloud-eu/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@opencloud-eu/web-pkg')>()),
  useMessages: vi.fn()
}))

function setup({
  numPages = 3,
  storageSize = 0
}: { numPages?: number; storageSize?: number } = {}) {
  const showErrorMessage = vi.fn()
  vi.mocked(useMessages).mockReturnValue({ showErrorMessage } as never)
  const extractPages = vi.fn().mockResolvedValue(new Uint8Array([7]))
  const saveDocument = vi.fn().mockResolvedValue(new Uint8Array([5]))
  const doc = mock<PDFDocumentProxy>({
    numPages,
    extractPages,
    saveDocument,
    annotationStorage: { size: storageSize }
  })
  const edits = {
    states: ref({ hasSomethingToUndo: false, hasSomethingToRedo: false, hasSelectedEditor: false }),
    undo: vi.fn(),
    redo: vi.fn()
  }
  const onDocumentChanged = vi.fn()
  const beforeChange = vi.fn().mockResolvedValue(undefined)
  const content = shallowRef(new Uint8Array([1]).buffer)
  // Loading the new document changes the current content.
  onDocumentChanged.mockImplementation((newContent: ArrayBuffer) => {
    content.value = newContent
  })
  let operations: ReturnType<typeof usePdfPageOperations>
  getComposableWrapper(() => {
    operations = usePdfPageOperations({
      pdfDocument: shallowRef(doc),
      edits,
      getContent: () => unref(content),
      getPageNumber: () => 2,
      getPassword: () => 'secret',
      beforeChange,
      onDocumentChanged
    })
  })
  return {
    operations,
    extractPages,
    saveDocument,
    beforeChange,
    onDocumentChanged,
    showErrorMessage,
    content,
    edits
  }
}

describe('usePdfPageOperations', () => {
  describe('getMovedPageIndices', () => {
    it.each([
      [4, 0, 1, [1, 0, 2, 3]],
      [4, 1, 0, [1, 0, 2, 3]],
      [4, 0, 3, [3, 0, 1, 2]],
      [4, 3, 0, [1, 2, 3, 0]],
      [3, 1, 1, [0, 1, 2]]
    ])('moves in %i pages page %i to %i', (count, from, to, expected) => {
      expect(getMovedPageIndices(count, from, to)).toEqual(expected)
    })
  })

  describe('deletePage', () => {
    it('extracts all other pages and reports the new document', async () => {
      const { operations, extractPages, onDocumentChanged } = setup()
      await operations.deletePage(3)
      expect(extractPages).toHaveBeenCalledWith([{ document: null, excludePages: [2] }])
      // The last page was deleted, so the new last page is shown. The others keep their numbers.
      expect(onDocumentChanged).toHaveBeenCalledWith(expect.any(ArrayBuffer), 2, [1, 2])
    })
  })

  describe('movePage', () => {
    it('reorders the pages and follows the moved page', async () => {
      const { operations, extractPages, onDocumentChanged } = setup()
      await operations.movePage(1, 2)
      expect(extractPages).toHaveBeenCalledWith([{ document: null, pageIndices: [1, 0, 2] }])
      expect(onDocumentChanged).toHaveBeenCalledWith(expect.any(ArrayBuffer), 2, [2, 1, 3])
    })
  })

  // They are outside of PDF.js' undo, which goes first.
  it('undoes and redoes page changes after the edits of PDF.js', async () => {
    const { operations, onDocumentChanged, content, edits } = setup()
    const original = content.value
    expect(operations.undoStates.value.hasSomethingToUndo).toBe(false)
    await operations.deletePage(1)
    const changed = content.value
    edits.states.value = { ...edits.states.value, hasSomethingToUndo: true }
    await operations.undo()
    expect(edits.undo).toHaveBeenCalled()
    edits.states.value = { ...edits.states.value, hasSomethingToUndo: false }
    expect(operations.undoStates.value.hasSomethingToUndo).toBe(true)
    await operations.undo()
    // The deleted first page is new again, the others move back.
    expect(onDocumentChanged).toHaveBeenLastCalledWith(original, 2, [undefined, 1, 2])
    expect(operations.undoStates.value).toMatchObject({
      hasSomethingToUndo: false,
      hasSomethingToRedo: true
    })
    await operations.redo()
    expect(onDocumentChanged).toHaveBeenLastCalledWith(changed, 2, expect.any(Array))
    await operations.undo()
    // A new edit makes redoing the page change pointless.
    edits.states.value = { ...edits.states.value, hasSomethingToUndo: true }
    await nextTick()
    expect(operations.undoStates.value.hasSomethingToRedo).toBe(false)
  })

  describe("form values, which are outside of PDF.js' undo", () => {
    function typeInto(layerClass: string) {
      const layer = document.createElement('div')
      layer.className = layerClass
      const input = layer.appendChild(document.createElement('input'))
      document.body.appendChild(layer)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      layer.remove()
    }

    it('end the page undo instead of getting lost', async () => {
      const { operations } = setup()
      await operations.deletePage(1)
      typeInto('annotationLayer')
      expect(operations.undoStates.value.hasSomethingToUndo).toBe(false)
    })

    it('are not the annotations of PDF.js, which it undoes itself', async () => {
      const { operations } = setup()
      await operations.deletePage(1)
      typeInto('annotationEditorLayer')
      expect(operations.undoStates.value.hasSomethingToUndo).toBe(true)
    })
  })

  it('keeps only as many steps as fit into memory, at least one', async () => {
    function largeContent() {
      return mock<ArrayBuffer>({ byteLength: 150_000_000 })
    }
    const { operations, content, extractPages, onDocumentChanged } = setup()
    content.value = largeContent()
    extractPages.mockImplementation(() => {
      const extracted = mock<Uint8Array>()
      const copy = mock<Uint8Array<ArrayBuffer>>()
      Object.defineProperty(copy, 'buffer', { value: largeContent() })
      extracted.slice.mockReturnValue(copy)
      return Promise.resolve(extracted)
    })
    await operations.deletePage(1)
    const afterFirst = content.value
    await operations.deletePage(1)
    await operations.undo()
    expect(onDocumentChanged).toHaveBeenLastCalledWith(afterFirst, 2, expect.any(Array))
    expect(operations.undoStates.value).toMatchObject({
      hasSomethingToUndo: false,
      hasSomethingToRedo: true
    })
  })

  it('tells the new thumbnails what to focus after a keyboard action', async () => {
    const { operations } = setup()
    const moving = operations.movePage(1, 2, true)
    expect(operations.lastAction.value).toEqual({ pageNumber: 2, focusTarget: 'page-actions' })
    await moving
    expect(operations.lastAction.value).toBeUndefined()
    operations.deletePage(2)
    expect(operations.lastAction.value).toBeUndefined()
  })

  it('includes unsaved changes by extracting from a saved copy', async () => {
    const savedDocExtractPages = vi.fn().mockResolvedValue(new Uint8Array([8]))
    const destroy = vi.fn()
    // Plain, a mock breaks the promise in it.
    vi.mocked(loadPdfDocument).mockReturnValue({
      promise: Promise.resolve({ extractPages: savedDocExtractPages }),
      destroy
    } as unknown as ReturnType<typeof loadPdfDocument>)

    const { operations, extractPages, saveDocument, onDocumentChanged } = setup({
      storageSize: 1
    })
    await operations.deletePage(1)

    expect(saveDocument).toHaveBeenCalled()
    expect(Array.from(new Uint8Array(vi.mocked(loadPdfDocument).mock.calls[0][0]))).toEqual([5])
    // A saved copy of a protected document is protected the same way.
    expect(vi.mocked(loadPdfDocument).mock.calls[0][1]).toEqual({ password: 'secret' })
    expect(extractPages).not.toHaveBeenCalled()
    expect(savedDocExtractPages).toHaveBeenCalledWith([{ document: null, excludePages: [0] }])
    expect(destroy).toHaveBeenCalled()
    expect(Array.from(new Uint8Array(onDocumentChanged.mock.calls[0][0]))).toEqual([8])
  })

  it('reports failures and unlocks again', async () => {
    const { operations, extractPages, onDocumentChanged, showErrorMessage } = setup()
    extractPages.mockRejectedValueOnce(new Error('broken'))
    await operations.deletePage(1)
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deleting the page failed' })
    )
    expect(onDocumentChanged).not.toHaveBeenCalled()
    expect(operations.isProcessing.value).toBe(false)
  })

  it('writes pending changes before rebuilding the document', async () => {
    const { operations, extractPages, beforeChange } = setup()
    await operations.deletePage(1)
    expect(beforeChange.mock.invocationCallOrder[0]).toBeLessThan(
      extractPages.mock.invocationCallOrder[0]
    )
  })

  // PDF.js' worker reports extraction errors as an empty result.
  it('reports an empty extraction result as failure', async () => {
    const { operations, extractPages, onDocumentChanged, showErrorMessage } = setup()
    extractPages.mockResolvedValueOnce(null)
    await operations.deletePage(1)
    expect(showErrorMessage).toHaveBeenCalled()
    expect(onDocumentChanged).not.toHaveBeenCalled()
  })

  it('runs one operation at a time', async () => {
    const { operations, extractPages } = setup()
    await Promise.all([operations.deletePage(1), operations.deletePage(2)])
    expect(extractPages).toHaveBeenCalledTimes(1)
    expect(operations.isProcessing.value).toBe(false)
  })
})
