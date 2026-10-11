import { computed, ref, shallowRef, toValue, unref, type MaybeRefOrGetter } from 'vue'
import { until, useEventListener, useTimeoutFn } from '@vueuse/core'
import {
  AnnotationEditorParamsType,
  AnnotationEditorType,
  type AnnotationEditorUIManager
} from 'pdfjs-dist'
import type { EventBus, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { isCreatingSignature, isDrawing as isViewerDrawing } from '../helpers/pdfjsInternals'

// PDF.js' move of the editor comes with two timeouts of 0 ms.
const CARET_RESTORE_MS = 200

export type EditingStates = {
  hasSomethingToUndo: boolean
  hasSomethingToRedo: boolean
  hasSelectedEditor: boolean
}

const NO_EDITING_STATES: EditingStates = {
  hasSomethingToUndo: false,
  hasSomethingToRedo: false,
  hasSelectedEditor: false
}

/** PDF.js' annotation editing: the active tool, its settings, undo/redo. */
export function usePdfEditing({
  eventBus,
  viewer
}: {
  eventBus: EventBus
  viewer: MaybeRefOrGetter<PDFViewer | undefined>
}) {
  // Missing for read-only files and XFA forms, PDF.js doesn't edit them.
  const uiManager = shallowRef<AnnotationEditorUIManager>()
  const editorMode = ref<number>(AnnotationEditorType.NONE)
  const isToolActive = computed(() => unref(editorMode) !== AnnotationEditorType.NONE)
  const editingStates = ref<EditingStates>(NO_EDITING_STATES)
  // Settings (color, size, …) by type as PDF.js reports them, like the inputs of the PDF.js
  // viewer: those of the selected annotation, otherwise the defaults for new ones.
  const editorParams = shallowRef<Map<number, unknown>>(new Map())

  eventBus.on('annotationeditoruimanager', (evt: { uiManager: AnnotationEditorUIManager }) => {
    uiManager.value = evt.uiManager
  })
  // PDF.js asks for a different tool, e.g. on double click on an existing annotation.
  eventBus.on('switchannotationeditormode', setAnnotationEditorMode)
  // E.g. "Comment" on selected text switches to the highlight tool first.
  eventBus.on('showannotationeditorui', ({ mode }: { mode: number }) =>
    setAnnotationEditorMode({ mode })
  )
  eventBus.on('annotationeditormodechanged', ({ mode }: { mode: number }) => {
    editorMode.value = mode
  })
  eventBus.on('editingstateschanged', ({ details }: { details: Partial<EditingStates> }) => {
    editingStates.value = { ...unref(editingStates), ...details }
  })
  eventBus.on(
    'annotationeditorparamschanged',
    ({ details }: { details: [type: number, value: unknown][] }) => setEditorParams(details)
  )

  function setEditorParams(details: [type: number, value: unknown][]) {
    editorParams.value = new Map([...unref(editorParams), ...details])
  }

  /** For a new document, PDF.js creates a new uiManager for it. */
  function reset() {
    uiManager.value = undefined
    editorMode.value = AnnotationEditorType.NONE
    editingStates.value = NO_EDITING_STATES
    editorParams.value = new Map()
  }

  // Same events as the toolbars of the PDF.js viewer, PDF.js' uiManager listens to them.
  function updateParams(type: number, value: unknown) {
    eventBus.dispatch('switchannotationeditorparams', { source: null, type, value })
  }

  function setAnnotationEditorMode(options: PDFViewer['annotationEditorMode']) {
    if (unref(uiManager)) {
      toValue(viewer).annotationEditorMode = options
    }
  }

  function setEditorMode(mode: number) {
    // Clicking the active tool again turns it off, like in the PDF.js viewer.
    setAnnotationEditorMode({
      mode: unref(editorMode) === mode ? AnnotationEditorType.NONE : mode
    })
  }

  /** Switches to the given tool (if needed) and resolves once PDF.js is ready for it. */
  async function ensureEditorMode(mode: number) {
    if (!unref(uiManager) || unref(editorMode) === mode) {
      return
    }
    toValue(viewer).annotationEditorMode = { mode }
    // Another switch in the meantime cancels this one.
    await until(editorMode).toBe(mode, { timeout: 1000 })
  }

  /**
   * Creates an annotation with the given tool, e.g. an image from a file. Without `params`
   * PDF.js asks for the content, e.g. opens the file dialog for images.
   */
  async function createEditor(mode: number, params: object | null = null) {
    await ensureEditorMode(mode)
    if (unref(editorMode) === mode) {
      updateParams(AnnotationEditorParamsType.CREATE, params)
    }
  }

  function selectTool(mode: number) {
    // A signature tool without a signature is no use, PDF.js asks for a new one right away,
    // also for further ones.
    if (mode === AnnotationEditorType.SIGNATURE) {
      createEditor(AnnotationEditorType.SIGNATURE)
      return
    }
    setEditorMode(mode)
  }

  function leaveTool() {
    setAnnotationEditorMode({ mode: AnnotationEditorType.NONE })
  }

  /**
   * AppWrapper closes the app on Escape. Inside the viewer PDF.js uses it to leave form fields
   * and to deselect annotations, so it must not bubble up. That also keeps it from PDF.js' own
   * listener on window, so it is handed over directly.
   */
  function handleEscape(event: KeyboardEvent) {
    event.stopPropagation()
    // Like in the PDF.js viewer, the tool stays active.
    unref(uiManager)?.keydown(event)
  }

  /**
   * Changes a tool setting (color, size, …), like in the PDF.js viewer: the selected
   * annotations, e.g. a drawing that was just finished, otherwise the annotations created from
   * now on. Switches to the tool first, the selection of another tool would get the setting.
   */
  async function updateEditorSetting(mode: number, type: number, value: unknown) {
    await ensureEditorMode(mode)
    if (unref(editorMode) !== mode) {
      return
    }
    // The setting applies to the drawing so far, which the PDF.js viewer finishes when the
    // focus moves to its settings.
    finishDrawings()
    setEditorParams([[type, value]])
    updateParams(type, value)
  }

  /**
   * The strokes of a drawing are one annotation, which PDF.js adds to its storage only once the
   * drawing is finished, e.g. when leaving the tool. While drawing, it disables text selection.
   */
  /** PDF.js disables text selection for drawing, and for dragging a selected annotation. */
  function isDrawing() {
    const pdfViewer = toValue(viewer)
    return !!pdfViewer && isViewerDrawing(pdfViewer) && !unref(uiManager)?.hasSelection
  }

  /**
   * Edits PDF.js keeps out of its storage until they're finished: drawings, text being typed, a
   * signature whose dialog is open (stored already, but it can't be saved yet).
   */
  function hasUnfinishedEdits() {
    const pdfViewer = toValue(viewer)
    return (
      isDrawing() ||
      !!unref(uiManager)?.getActive() ||
      (!!pdfViewer && isCreatingSignature(pdfViewer))
    )
  }

  /**
   * The strokes of a drawing become an annotation once the drawing is finished. PDF.js does that
   * when the page loses the focus, which clicking a button doesn't do in every browser (Safari).
   */
  function finishDrawings() {
    const manager = unref(uiManager)
    for (let pageIndex = 0; pageIndex < (toValue(viewer)?.pagesCount ?? 0); pageIndex++) {
      manager?.getLayer(pageIndex)?.commitOrRemove()
    }
  }

  /**
   * Finishes these edits, so they are part of the document. Returns a function to go on
   * typing where the text was left, e.g. after saving.
   */
  function commitEditing() {
    commitFormField()
    const manager = unref(uiManager)
    if (!manager) {
      return () => {}
    }
    const editor = manager.getActive() as { div: HTMLElement; enterInEditMode?(): void } | null
    const selection = document.getSelection()
    const caret = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : undefined
    manager.commitOrRemove()
    finishDrawings()
    return () => {
      // Gone if the text was empty.
      if (!editor?.enterInEditMode || !editor.div.isConnected) {
        return
      }
      editor.enterInEditMode()
      const text = editor.div.querySelector<HTMLElement>('[contenteditable="true"]')
      if (caret && editor.div.contains(caret.startContainer)) {
        selection.removeAllRanges()
        selection.addRange(caret)
      } else if (text) {
        // PDF.js may have rebuilt the text in the meantime, typing goes on at its end then.
        selection.selectAllChildren(text)
        selection.collapseToEnd()
      }
      if (text) {
        keepCaretAcrossMove(text)
      }
    }
  }

  /**
   * PDF.js moves a committed editor in the DOM a moment later (for the tab order), which loses
   * the focus for an instant and puts the caret at the start when it comes back. It comes back
   * where it was: the text node survives the move, a range would collapse with it.
   */
  function keepCaretAcrossMove(text: HTMLElement) {
    let caret: { node: Node; offset: number } | undefined
    const track = () => {
      const selection = document.getSelection()
      if (selection?.anchorNode && text.contains(selection.anchorNode)) {
        caret = { node: selection.anchorNode, offset: selection.anchorOffset }
      }
    }
    const restore = () => {
      if (caret && text.contains(caret.node)) {
        const length = caret.node.textContent?.length ?? 0
        document.getSelection()?.collapse(caret.node, Math.min(caret.offset, length))
      }
      stop()
    }
    track()
    const stops = [
      // selectionchange comes in a later task, a key typed right before the move shows only here.
      useEventListener(text, 'input', track),
      useEventListener(document, 'selectionchange', track),
      useEventListener(text, 'focusin', restore),
      useTimeoutFn(stop, CARET_RESTORE_MS).stop
    ]
    function stop() {
      stops.forEach((stopOne) => stopOne())
    }
  }

  // Typed into since it was committed, PDF.js commits unchanged fields neither.
  let typedField: EventTarget | undefined
  // Committed for saving while it keeps the focus, see filterSandboxUpdate().
  let committedField: { id: string; element: EventTarget } | undefined
  useEventListener(document, 'input', (event: Event) => (typedField = event.target), {
    capture: true
  })
  useEventListener(document, 'focusout', () => (committedField = undefined), { capture: true })

  /**
   * PDF.js lets the form scripts commit (format, calculate) a text field once it loses the focus,
   * which changes the storage. Committed before saving, the blur afterwards changes nothing.
   */
  function commitFormField() {
    const field = document.activeElement
    if (
      field !== typedField ||
      !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) ||
      !['text', 'password', 'textarea'].includes(field.type) ||
      !field.closest('.annotationLayer')
    ) {
      return
    }
    typedField = undefined
    committedField = { id: field.dataset.elementId, element: field }
    // The same event as PDF.js sends on blur.
    eventBus.dispatch('dispatcheventinsandbox', {
      source: null,
      detail: {
        id: field.dataset.elementId,
        name: 'Keystroke',
        value: field.value,
        willCommit: true,
        commitKey: 1,
        selStart: field.selectionStart,
        selEnd: field.selectionEnd
      }
    })
  }

  /**
   * The scripts answer a commit with the value of the field, which PDF.js writes into it even
   * while it has the focus. Typed into since it was committed for saving, what was typed would
   * be lost, so the value is left out then: the field has it, and the scripts get it with the
   * next commit.
   */
  function filterSandboxUpdate<T extends { id?: string; value?: unknown }>(detail: T): T {
    if (
      committedField &&
      detail.id === committedField.id &&
      typedField === committedField.element &&
      'value' in detail
    ) {
      const filtered = { ...detail }
      delete filtered.value
      return filtered
    }
    return detail
  }

  function undo() {
    // Undoes the drawing so far as a whole, like after clicking anywhere else.
    finishDrawings()
    eventBus.dispatch('editingaction', { source: null, name: 'undo' })
  }

  function redo() {
    eventBus.dispatch('editingaction', { source: null, name: 'redo' })
  }

  return {
    uiManager,
    editorMode,
    isToolActive,
    editingStates,
    editorParams,
    reset,
    createEditor,
    selectTool,
    leaveTool,
    handleEscape,
    isDrawing,
    hasUnfinishedEdits,
    finishDrawings,
    commitEditing,
    filterSandboxUpdate,
    updateEditorSetting,
    undo,
    redo
  }
}
