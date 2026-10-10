import { shallowRef } from 'vue'
import { mock } from 'vitest-mock-extended'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import type { EventBus, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { usePdfEditing } from '../../../src/composables/usePdfEditing'

vi.mock('pdfjs-dist', () => ({
  AnnotationEditorType: { NONE: 0, HIGHLIGHT: 9, INK: 15, SIGNATURE: 101 },
  AnnotationEditorParamsType: { CREATE: 2, INK_THICKNESS: 22, FREETEXT_SIZE: 11 }
}))

function createEventBus() {
  const listeners = new Map<string, ((evt: unknown) => void)[]>()
  return mock<EventBus>({
    on: (name: string, listener: (evt: unknown) => void) =>
      listeners.set(name, [...(listeners.get(name) ?? []), listener]),
    off: (name: string, listener: (evt: unknown) => void) =>
      listeners.set(
        name,
        (listeners.get(name) ?? []).filter((l) => l !== listener)
      ),
    dispatch: (name: string, evt: unknown) => listeners.get(name)?.forEach((l) => l(evt))
  })
}

function setup() {
  const eventBus = createEventBus()
  const viewer = mock<PDFViewer>({ pagesCount: 2 })
  Object.defineProperties(viewer, {
    viewer: { value: document.createElement('div') },
    // PDF.js switches tools asynchronously and reports it.
    annotationEditorMode: {
      set: ({ mode }: { mode: number }) =>
        queueMicrotask(() => eventBus.dispatch('annotationeditormodechanged', { mode }))
    }
  })
  const layers = [{ commitOrRemove: vi.fn() }, { commitOrRemove: vi.fn() }]
  const uiManager = {
    hasSelection: false,
    getActive: vi.fn(),
    getLayer: (pageIndex: number) => layers[pageIndex],
    commitOrRemove: vi.fn(),
    firstSelectedEditor: undefined as unknown,
    keydown: vi.fn(),
    unselectAll: vi.fn(),
    updateParams: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn()
  }
  let editing: ReturnType<typeof usePdfEditing>
  getComposableWrapper(() => {
    editing = usePdfEditing({
      eventBus,
      viewer: shallowRef(viewer)
    })
  })
  // Like PDF.js' uiManager, see pdfjsInternals.spec.ts.
  eventBus.on('switchannotationeditorparams', ({ type, value }: { type: number; value: unknown }) =>
    uiManager.updateParams(type, value)
  )
  eventBus.on('editingaction', ({ name }: { name: 'undo' | 'redo' }) => uiManager[name]())
  eventBus.dispatch('annotationeditoruimanager', { uiManager })
  return { editing, eventBus, uiManager, viewer, layers }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve))
}

describe('usePdfEditing', () => {
  it('follows the tool PDF.js reports', async () => {
    const { editing } = setup()
    editing.selectTool(15)
    await flush()
    expect(editing.editorMode.value).toBe(15)
    // The active tool again turns it off.
    editing.selectTool(15)
    await flush()
    expect(editing.editorMode.value).toBe(0)
  })

  it('creates annotations once the tool is ready', async () => {
    const { editing, uiManager } = setup()
    await editing.createEditor(9, { foo: 1 })
    expect(editing.editorMode.value).toBe(9)
    expect(uiManager.updateParams).toHaveBeenCalledWith(2, { foo: 1 })
  })

  it('asks for a new signature right away when choosing the signature tool', async () => {
    const { editing, uiManager } = setup()
    editing.selectTool(101)
    await flush()
    expect(uiManager.updateParams).toHaveBeenCalledWith(2, null)
    // Also for further signatures, instead of leaving the tool.
    editing.selectTool(101)
    await flush()
    expect(uiManager.updateParams).toHaveBeenCalledTimes(2)
    expect(editing.editorMode.value).toBe(101)
  })

  describe('Escape', () => {
    function escape() {
      return new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    }

    it('hands it to PDF.js and keeps the tool, like the PDF.js viewer', async () => {
      const { editing, uiManager } = setup()
      editing.selectTool(15)
      await flush()
      const event = escape()
      editing.handleEscape(event)
      await flush()
      expect(uiManager.keydown).toHaveBeenCalledWith(event)
      expect(editing.editorMode.value).toBe(15)
    })

    it('leaves Escape alone once something handled it, e.g. the find bar', () => {
      const { editing, uiManager } = setup()
      const event = escape()
      event.preventDefault()
      editing.handleEscape(event)
      expect(uiManager.keydown).not.toHaveBeenCalled()
    })
  })

  describe('tool settings', () => {
    it('change the selection, otherwise the defaults (PDF.js decides)', async () => {
      const { editing, uiManager } = setup()
      editing.selectTool(15)
      await flush()
      await editing.updateEditorSetting(15, 22, 5)
      expect(uiManager.updateParams).toHaveBeenCalledWith(22, 5)
      expect(uiManager.unselectAll).not.toHaveBeenCalled()
      expect(editing.editorParams.value.get(22)).toBe(5)
    })

    // A selection of another tool would get the setting.
    it('switch to their tool first', async () => {
      const { editing, uiManager } = setup()
      await editing.updateEditorSetting(9, 31, '#FFFF98')
      expect(editing.editorMode.value).toBe(9)
      expect(uiManager.updateParams).toHaveBeenCalledWith(31, '#FFFF98')
    })

    it('finish the drawing so far, which then gets the setting', async () => {
      const { editing, layers } = setup()
      editing.selectTool(15)
      await flush()
      await editing.updateEditorSetting(15, 22, 5)
      expect(layers[0].commitOrRemove).toHaveBeenCalled()
    })

    // E.g. of a selected annotation, or the defaults when a new drawing starts.
    it('show what PDF.js reports', () => {
      const { editing, eventBus } = setup()
      eventBus.dispatch('annotationeditorparamschanged', { details: [[22, 10]] })
      expect(editing.editorParams.value.get(22)).toBe(10)
      eventBus.dispatch('annotationeditorparamschanged', { details: [[22, 1]] })
      expect(editing.editorParams.value.get(22)).toBe(1)
    })
  })

  it('knows about edits PDF.js keeps out of its storage until they are finished', () => {
    const { editing, uiManager, viewer } = setup()
    expect(editing.hasUnfinishedEdits()).toBe(false)
    // Text being typed.
    uiManager.getActive.mockReturnValue({})
    expect(editing.hasUnfinishedEdits()).toBe(true)
    uiManager.getActive.mockReturnValue(null)
    // A drawing.
    viewer.viewer.classList.add('noUserSelect')
    expect(editing.isDrawing()).toBe(true)
    expect(editing.hasUnfinishedEdits()).toBe(true)
  })

  it('knows about a signature whose dialog is open, it cannot be saved yet', () => {
    const { editing, viewer } = setup()
    const signature = document.createElement('div')
    signature.className = 'signatureEditor'
    signature.hidden = true
    viewer.viewer.append(signature)
    expect(editing.hasUnfinishedEdits()).toBe(true)
    signature.hidden = false
    expect(editing.hasUnfinishedEdits()).toBe(false)
  })

  // Otherwise the scripts commit it when it loses the focus, after the save.
  it('lets the form scripts commit the focused text field, like PDF.js on blur', () => {
    const { editing, eventBus } = setup()
    const sandboxEvents: unknown[] = []
    eventBus.on('dispatcheventinsandbox', ({ detail }: { detail: unknown }) =>
      sandboxEvents.push(detail)
    )
    const layer = document.createElement('div')
    layer.className = 'annotationLayer'
    const field = document.createElement('input')
    field.dataset.elementId = '12R'
    field.value = 'AAA'
    layer.append(field)
    document.body.append(layer)
    field.focus()
    // Unchanged, like PDF.js on blur.
    editing.commitEditing()
    expect(sandboxEvents).toHaveLength(0)
    field.dispatchEvent(new Event('input', { bubbles: true }))
    editing.commitEditing()
    expect(sandboxEvents).toEqual([
      expect.objectContaining({ id: '12R', name: 'Keystroke', value: 'AAA', willCommit: true })
    ])
    editing.commitEditing()
    expect(sandboxEvents).toHaveLength(1)

    // Not checkboxes and the like, nor fields outside the document.
    field.type = 'checkbox'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    editing.commitEditing()
    field.type = 'text'
    document.body.append(field)
    field.focus()
    field.dispatchEvent(new Event('input', { bubbles: true }))
    editing.commitEditing()
    expect(sandboxEvents).toHaveLength(1)
    document.body.innerHTML = ''
  })

  it('finishes text being typed and drawings on all pages', () => {
    const { editing, uiManager, layers } = setup()
    editing.commitEditing()
    expect(uiManager.commitOrRemove).toHaveBeenCalled()
    expect(layers.every(({ commitOrRemove }) => commitOrRemove.mock.calls.length)).toBe(true)
  })

  it('undoes and redoes, the drawing so far as a whole', () => {
    const { editing, uiManager, layers } = setup()
    editing.undo()
    expect(layers[0].commitOrRemove).toHaveBeenCalled()
    expect(uiManager.undo).toHaveBeenCalled()
    editing.redo()
    expect(uiManager.redo).toHaveBeenCalled()
  })

  it('switches tools when PDF.js asks, e.g. "Comment" on selected text', async () => {
    const { editing, eventBus } = setup()
    eventBus.dispatch('showannotationeditorui', { mode: 9 })
    await flush()
    expect(editing.editorMode.value).toBe(9)
  })
})
