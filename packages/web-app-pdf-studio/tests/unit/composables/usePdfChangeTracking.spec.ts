import { ref, shallowRef } from 'vue'
import { mock } from 'vitest-mock-extended'
import { AnnotationEditorType, type PDFDocumentProxy } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfChangeTracking } from '../../../src/composables/usePdfChangeTracking'

function createDocument() {
  const state = {
    hash: '',
    isSerializable: true,
    transfer: [] as { close: () => void }[],
    map: new Map<string, object>()
  }
  const mocks = {
    annotationStorage: {
      get serializable() {
        if (!state.isSerializable) {
          throw new TypeError("Cannot read properties of null (reading 'serialize')")
        }
        return { map: state.map, hash: state.hash, transfer: state.transfer }
      }
    },
    saveDocument: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    getData: vi.fn().mockResolvedValue(new Uint8Array([9]))
  }
  // mock() would replace the storage's getter by its value.
  const doc = mock<PDFDocumentProxy>({
    saveDocument: mocks.saveDocument,
    getData: mocks.getData
  })
  Object.defineProperty(doc, 'annotationStorage', { value: mocks.annotationStorage })
  return { doc, state, mocks }
}

function setup(
  doc: PDFDocumentProxy,
  {
    startTracking = true,
    isEnabled = true,
    isDirty = false,
    isDrawing = false,
    hasUnfinishedEdits = false
  } = {}
) {
  const state = { isDirty, isDrawing, hasUnfinishedEdits }
  const pdfDocument = shallowRef<PDFDocumentProxy>(doc)
  const root = document.createElement('div')
  document.body.append(root)
  const content = new Uint8Array([4, 2]).buffer
  const onChange = vi.fn()
  const commitEditing = vi.fn()
  const onError = vi.fn()
  let tracking: ReturnType<typeof usePdfChangeTracking>
  getComposableWrapper(() => {
    tracking = usePdfChangeTracking({
      pdfDocument,
      root: ref(root),
      isEnabled: () => isEnabled,
      content,
      isDirty: () => state.isDirty,
      isDrawing: () => state.isDrawing,
      hasUnfinishedEdits: () => state.hasUnfinishedEdits,
      commitEditing,
      onChange,
      onError
    })
  })
  // The first interaction starts the tracking.
  if (startTracking) {
    root.dispatchEvent(new Event('pointerdown'))
  }
  return { tracking, onChange, onError, pdfDocument, root, content, commitEditing, state }
}

describe('usePdfChangeTracking', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('does not check when disabled, e.g. for read-only files', async () => {
    vi.useFakeTimers()
    const { doc, state, mocks } = createDocument()
    const { tracking } = setup(doc, { isEnabled: false })
    state.hash = 'a'
    tracking.scheduleCheck()
    await vi.runAllTimersAsync()
    expect(mocks.saveDocument).not.toHaveBeenCalled()
  })

  it('frees the bitmap copies made for the hash', () => {
    const { doc, state } = createDocument()
    const bitmap = { close: vi.fn() }
    state.transfer = [bitmap]
    setup(doc)
    expect(bitmap.close).toHaveBeenCalled()
  })

  // AppWrapper decides about unsaved changes right away, e.g. when closing the app.
  it('reports pending changes at once when the user reaches outside the app', async () => {
    const { doc, state } = createDocument()
    const { onChange, content, commitEditing } = setup(doc)
    state.hash = 'a'
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(commitEditing).toHaveBeenCalled()
    // A copy of the last content marks the file as changed, the new content follows.
    const [[marker]] = onChange.mock.calls
    expect(marker).not.toBe(content)
    expect(Array.from(new Uint8Array(marker))).toEqual([4, 2])
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(Array.from(new Uint8Array(onChange.mock.calls[1][0]))).toEqual([1, 2, 3])
  })

  it('tells whether a save may have taken the copy that marked the file', () => {
    const { doc, state } = createDocument()
    const { tracking } = setup(doc)
    expect(tracking.takeChangeMarker()).toBe(false)
    state.hash = 'a'
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(tracking.takeChangeMarker()).toBe(true)
    expect(tracking.takeChangeMarker()).toBe(false)
  })

  it('reports changes that could not be written', async () => {
    vi.useFakeTimers()
    const { doc, state, mocks } = createDocument()
    const error = new Error('broken')
    mocks.saveDocument.mockRejectedValue(error)
    const { tracking, onError } = setup(doc)
    state.hash = 'a'
    tracking.scheduleCheck()
    await vi.runAllTimersAsync()
    expect(onError).toHaveBeenCalledWith(error)
  })

  // PDF.js stores text being typed and drawings only once they are finished.
  it('marks the file as changed while typing or drawing', async () => {
    vi.useFakeTimers()
    const { doc } = createDocument()
    const { onChange, root, state } = setup(doc)
    root.dispatchEvent(new Event('input', { bubbles: true }))
    expect(onChange).not.toHaveBeenCalled()
    // Clicking into a text box changes nothing yet.
    state.hasUnfinishedEdits = true
    root.dispatchEvent(new Event('pointerup', { bubbles: true }))
    await vi.runAllTimersAsync()
    expect(onChange).not.toHaveBeenCalled()
    // Still drawing after PDF.js handled the pointer, unlike after dragging an annotation.
    state.isDrawing = true
    root.dispatchEvent(new Event('pointerup', { bubbles: true }))
    state.isDrawing = false
    await vi.runAllTimersAsync()
    expect(onChange).not.toHaveBeenCalled()
    state.isDrawing = true
    root.dispatchEvent(new Event('pointerup', { bubbles: true }))
    await vi.runAllTimersAsync()
    expect(Array.from(new Uint8Array(onChange.mock.calls[0][0]))).toEqual([4, 2])
    // Marked once, not for every key.
    state.isDirty = true
    root.dispatchEvent(new Event('input', { bubbles: true }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('marks the file as changed right away, the new content follows', async () => {
    vi.useFakeTimers()
    const { doc, state } = createDocument()
    const { tracking, onChange } = setup(doc)
    state.hash = 'a'
    tracking.scheduleCheck()
    expect(Array.from(new Uint8Array(onChange.mock.calls[0][0]))).toEqual([4, 2])
    await vi.runAllTimersAsync()
    expect(Array.from(new Uint8Array(onChange.mock.calls[1][0]))).toEqual([1, 2, 3])
  })

  it('marks with the newest content, not the one of the last render', async () => {
    const { doc, state: storage } = createDocument()
    const { tracking, onChange, root, state } = setup(doc)
    storage.hash = 'a'
    await tracking.flush()
    state.hasUnfinishedEdits = true
    root.dispatchEvent(new Event('input', { bubbles: true }))
    expect(Array.from(new Uint8Array(onChange.mock.calls[1][0]))).toEqual([1, 2, 3])
  })

  it('leaves interactions inside the app alone', () => {
    const { doc, state } = createDocument()
    const { onChange, root, commitEditing } = setup(doc)
    state.hash = 'a'
    root.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(commitEditing).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does nothing as long as the storage is unchanged', async () => {
    const { doc, mocks } = createDocument()
    const { tracking, onChange } = setup(doc)
    expect(await tracking.flush()).toBe(false)
    expect(mocks.saveDocument).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('emits the saved document once the storage changed', async () => {
    const { doc, state } = createDocument()
    const { tracking, onChange } = setup(doc)
    state.hash = 'a'
    expect(await tracking.flush()).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(Array.from(new Uint8Array(onChange.mock.calls[0][0]))).toEqual([1, 2, 3])

    // Same storage again, nothing new to emit.
    expect(await tracking.flush()).toBe(false)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  // AppWrapper compares by reference, so undoing every change is no change anymore.
  it('emits the saved content when its state is reached again', async () => {
    const { doc, state, mocks } = createDocument()
    const { tracking, onChange, content } = setup(doc)
    state.hash = 'a'
    await tracking.flush()
    state.hash = ''
    await tracking.flush()
    expect(onChange.mock.calls[1][0]).toBe(content)
    expect(mocks.getData).not.toHaveBeenCalled()
    // After saving a change, its state is the saved one, with the content saved then.
    state.hash = 'a'
    await tracking.flush()
    tracking.markSaved()
    state.hash = 'b'
    await tracking.flush()
    state.hash = 'a'
    await tracking.flush()
    expect(onChange.mock.calls[4][0]).toBe(content)
    expect(mocks.saveDocument).toHaveBeenCalledTimes(3)
  })

  it('emits the original bytes when all annotations were removed again', async () => {
    const { doc, state, mocks } = createDocument()
    // E.g. form scripts filled the storage when opening.
    state.hash = 'scripts'
    const { tracking, onChange } = setup(doc)
    state.hash = ''
    await tracking.flush()
    expect(mocks.getData).toHaveBeenCalled()
    expect(Array.from(new Uint8Array(onChange.mock.calls[0][0]))).toEqual([9])
  })

  it('writes the changes after a delay when scheduled', async () => {
    vi.useFakeTimers()
    const { doc, state, mocks } = createDocument()
    const { tracking } = setup(doc, { isDirty: true })
    state.hash = 'a'
    tracking.scheduleCheck()
    tracking.scheduleCheck()
    expect(mocks.saveDocument).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(mocks.saveDocument).toHaveBeenCalledTimes(1)
  })

  it('serializes concurrent flushes', async () => {
    const { doc, state, mocks } = createDocument()
    const { tracking, onChange } = setup(doc)
    state.hash = 'a'
    const results = await Promise.all([tracking.flush(), tracking.flush(), tracking.flush()])
    expect(results).toEqual([true, false, false])
    expect(mocks.saveDocument).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('picks up changes made while saving', async () => {
    vi.useFakeTimers()
    const { doc, state, mocks } = createDocument()
    const { tracking, onChange } = setup(doc)
    state.hash = 'a'
    mocks.saveDocument.mockImplementationOnce(() => {
      state.hash = 'b'
      return Promise.resolve(new Uint8Array([1]))
    })
    await tracking.flush()
    await vi.runAllTimersAsync()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('drops the result if the document was replaced while saving', async () => {
    const { doc, state, mocks } = createDocument()
    const { tracking, onChange, pdfDocument } = setup(doc)
    state.hash = 'a'
    mocks.saveDocument.mockImplementationOnce(() => {
      pdfDocument.value = createDocument().doc
      return Promise.resolve(new Uint8Array([1]))
    })
    expect(await tracking.flush()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('starts over for a newly loaded document', async () => {
    const { doc, state } = createDocument()
    const { tracking, onChange, root } = setup(doc)
    state.hash = 'a'
    await tracking.flush()
    tracking.reset()
    state.hash = 'b'
    expect(await tracking.flush()).toBe(false)
    root.dispatchEvent(new Event('pointerdown'))
    expect(await tracking.flush()).toBe(false)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('reports nothing before the user interacted', async () => {
    const { doc, state, mocks } = createDocument()
    const { tracking, onChange } = setup(doc, { startTracking: false })
    state.hash = 'a'
    expect(await tracking.flush()).toBe(false)
    expect(mocks.saveDocument).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it.each(['pointerdown', 'keydown', 'beforeinput', 'drop'])(
    'takes the state at the first %s in the app as unchanged',
    async (eventName) => {
      const { doc, state } = createDocument()
      state.hash = 'calculated-on-open'
      const { tracking, root, onChange } = setup(doc, { startTracking: false })
      root.dispatchEvent(new Event(eventName))
      state.hash = 'edited'
      expect(await tracking.flush()).toBe(true)
      expect(onChange).toHaveBeenCalledTimes(1)
    }
  )

  it('takes the state as unchanged once a form field gets the focus, e.g. for autofill', async () => {
    const { doc, state } = createDocument()
    state.hash = 'calculated-on-open'
    const { tracking, root, onChange } = setup(doc, { startTracking: false })
    root.dispatchEvent(new FocusEvent('focusin'))
    const field = document.createElement('input')
    root.append(field)
    field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    state.hash = 'autofilled'
    expect(await tracking.flush()).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it.each(['pointerup', 'keyup', 'input', 'change'])(
    'checks for changes after %s in the app',
    async (eventName) => {
      vi.useFakeTimers()
      const { doc, state, mocks } = createDocument()
      const { root } = setup(doc, { isDirty: true })
      state.hash = 'a'
      root.dispatchEvent(new Event(eventName))
      await vi.runAllTimersAsync()
      expect(mocks.saveDocument).toHaveBeenCalledTimes(1)
    }
  )

  it('does not count what form scripts did when opening the document', async () => {
    const { doc, state } = createDocument()
    state.hash = 'calculated-on-open'
    const { tracking, onChange } = setup(doc)
    expect(await tracking.flush()).toBe(false)
    state.hash = 'edited'
    expect(await tracking.flush()).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('waits while an annotation is still being created and cannot be serialized', async () => {
    const { doc, state: docState, mocks } = createDocument()
    const { tracking, onChange, state } = setup(doc)
    docState.hash = 'a'
    docState.isSerializable = false
    state.hasUnfinishedEdits = true
    expect(await tracking.flush()).toBe(false)
    expect(mocks.saveDocument).not.toHaveBeenCalled()

    docState.isSerializable = true
    state.hasUnfinishedEdits = false
    expect(await tracking.flush()).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  // E.g. a PDF.js bug, saving the old content instead would lose every later edit.
  it('keeps the file changed when PDF.js cannot serialize its storage', async () => {
    vi.useFakeTimers()
    const { doc, state, mocks } = createDocument()
    const { tracking, onChange, onError, content } = setup(doc)
    state.hash = 'a'
    state.isSerializable = false
    tracking.scheduleCheck()
    expect(Array.from(new Uint8Array(onChange.mock.calls[0][0]))).toEqual([4, 2])
    expect(onChange.mock.calls[0][0]).not.toBe(content)
    // Checks in between don't report it over and over, saving does.
    await vi.runAllTimersAsync()
    expect(onError).not.toHaveBeenCalled()
    await expect(tracking.flush()).rejects.toThrow(/Cannot read properties of null/)
    expect(mocks.saveDocument).not.toHaveBeenCalled()
    expect(tracking.takeChangeMarker()).toBe(true)

    state.isSerializable = true
    expect(await tracking.flush()).toBe(true)
    expect(Array.from(new Uint8Array(onChange.mock.calls.at(-1)[0]))).toEqual([1, 2, 3])
  })

  it('waits until a new image is loaded, PDF.js cannot save it without its bitmap', async () => {
    vi.useFakeTimers()
    const { doc, state, mocks } = createDocument()
    const { tracking, onChange } = setup(doc, { isDirty: true })
    state.hash = 'a'
    state.map.set('stamp', { annotationType: AnnotationEditorType.STAMP, bitmapId: null })
    tracking.scheduleCheck()
    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.saveDocument).not.toHaveBeenCalled()

    state.map.set('stamp', { annotationType: AnnotationEditorType.STAMP, bitmapId: 'image' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.saveDocument).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
