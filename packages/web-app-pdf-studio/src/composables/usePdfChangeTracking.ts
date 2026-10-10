import { toValue, type MaybeRefOrGetter } from 'vue'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { AnnotationEditorType, type PDFDocumentProxy } from 'pdfjs-dist'

/** PDF.js can't serialize an annotation, e.g. because of a bug of PDF.js. */
class SerializeError extends Error {}

const CHECK_DELAY_MS = 300
// Writing a large file takes a moment, so changes in quick succession are collected longer.
const LARGE_FILE_BYTES = 50_000_000
const LARGE_FILE_CHECK_DELAY_MS = 1000

/**
 * Turns edits in PDF.js' annotation storage (form values and annotation editors) into
 * new file contents.
 *
 * `annotationStorage.onSetModified` alone is not enough: it only fires on the first change
 * after a save, and editors that are already stored (moved, resized, recolored) don't
 * trigger it at all. Instead, callers report possible changes via `scheduleCheck()` and the
 * storage hash decides whether anything actually changed.
 *
 * Opening a document can fill the storage as well, e.g. form scripts that calculate fields.
 * That must not count as a change, so the storage state at the user's first interaction
 * (`startTracking()`) is the baseline. Before that, nothing is reported.
 */
export function usePdfChangeTracking({
  pdfDocument,
  root,
  isEnabled,
  content,
  isDirty,
  isDrawing,
  hasUnfinishedEdits,
  commitEditing,
  onChange,
  onError
}: {
  pdfDocument: MaybeRefOrGetter<PDFDocumentProxy | undefined>
  /** The app, interactions outside of it may need the latest content. */
  root: MaybeRefOrGetter<HTMLElement | null>
  /** E.g. false for read-only files. */
  isEnabled: MaybeRefOrGetter<boolean>
  content: MaybeRefOrGetter<ArrayBuffer>
  isDirty: MaybeRefOrGetter<boolean>
  /** Whether strokes are being drawn, PDF.js stores them once the drawing is finished. */
  isDrawing: () => boolean
  /**
   * Edits PDF.js keeps out of its storage until they're finished, e.g. text being typed. A
   * storage that can't be serialized meanwhile is not an error.
   */
  hasUnfinishedEdits: () => boolean
  /** Writes what is being edited into the storage, e.g. text still being typed. */
  commitEditing: () => void
  onChange: (content: ArrayBuffer) => void
  /** Writing the changes failed, e.g. PDF.js can't write this file. */
  onError: (error: Error) => void
}) {
  // The hash of the storage that the last emitted content (or the baseline) was built from.
  let emittedHash = ''
  let isTracking = false
  let runningFlush: Promise<boolean> | undefined
  // A copy of the last content was emitted to mark the file as changed, see markChanged().
  let hasEmittedMarker = false
  // What was emitted last, the props catch up only with the next render.
  let latestContent: ArrayBuffer | undefined
  // The storage state of the content last saved (or loaded), see markSaved().
  let saved: { hash: string; content: ArrayBuffer } | undefined

  const { start: startCheckTimer, stop: cancelCheck } = useTimeoutFn(
    () =>
      flush().catch((error) => {
        // It fails as long as the annotation stays as it is, saving reports it.
        if (!(error instanceof SerializeError)) {
          onError(error)
        }
      }),
    () =>
      toValue(content).byteLength > LARGE_FILE_BYTES ? LARGE_FILE_CHECK_DELAY_MS : CHECK_DELAY_MS,
    { immediate: false }
  )

  function scheduleCheck() {
    if (!toValue(isEnabled)) {
      return
    }
    // Marked as changed right away, writing the new content takes a moment.
    if (!toValue(isDirty) && hasPendingChanges()) {
      markChanged()
    }
    startCheckTimer()
  }

  function reset() {
    cancelCheck()
    emittedHash = ''
    isTracking = false
    hasEmittedMarker = false
    latestContent = undefined
    saved = undefined
  }

  function emit(newContent: ArrayBuffer) {
    latestContent = newContent
    onChange(newContent)
  }

  /**
   * Marks the file as changed with a copy of the last content, for changes whose content
   * follows later: AppWrapper decides about unsaved changes right away (e.g. when closing),
   * and PDF.js keeps some edits out of its storage until they're finished.
   */
  function markChanged() {
    hasEmittedMarker = true
    if (!toValue(isDirty)) {
      emit((latestContent ?? toValue(content)).slice(0))
    }
  }

  /** Takes the current storage as the unchanged state, once per document. */
  function startTracking() {
    const doc = toValue(pdfDocument)
    if (isTracking || !doc) {
      return
    }
    const { hash } = readStorage(doc)
    if (hash === undefined) {
      return
    }
    emittedHash = hash
    isTracking = true
    saved = { hash, content: toValue(content) }
  }

  /**
   * The current content is saved now. Getting back to its state, e.g. by undoing, emits exactly
   * that content again, which AppWrapper takes as unchanged.
   */
  function markSaved() {
    if (isTracking) {
      saved = { hash: emittedHash, content: toValue(content) }
    }
  }

  /** The hash of the storage, undefined while it can't be saved (yet). */
  function readStorage(doc: PDFDocumentProxy): {
    hash?: string
    isImageLoading: boolean
    error?: SerializeError
  } {
    try {
      const { map, hash, transfer } = doc.annotationStorage.serializable
      // Copies of image bitmaps, meant to be transferred to the worker. Only the hash is needed.
      for (const bitmap of transfer ?? []) {
        ;(bitmap as ImageBitmap).close?.()
      }
      // An image that is still loading has no bitmap yet, so saving it would fail.
      const isImageLoading = hasLoadingImage(map)
      return { hash: isImageLoading ? undefined : hash, isImageLoading }
    } catch (error) {
      // An annotation that is still being created (e.g. a signature while its dialog is
      // open) can't be serialized yet. It reports the change once it is done.
      if (hasUnfinishedEdits()) {
        return { isImageLoading: false }
      }
      return { isImageLoading: false, error: new SerializeError(String(error), { cause: error }) }
    }
  }

  function hasLoadingImage(map: Map<string, unknown> | undefined) {
    return [...(map?.values() ?? [])].some((value) => {
      const { annotationType, bitmapId, id } = value as Record<string, unknown>
      return annotationType === AnnotationEditorType.STAMP && !id && !bitmapId
    })
  }

  /** The hash of changes that were not emitted yet, if any. */
  function getChanges(): { hash?: string; isImageLoading: boolean; error?: SerializeError } {
    const doc = toValue(pdfDocument)
    if (!doc || !isTracking) {
      return { isImageLoading: false }
    }
    const { hash, ...state } = readStorage(doc)
    return { hash: hash === emittedHash ? undefined : hash, ...state }
  }

  function hasPendingChanges() {
    const { hash, error } = getChanges()
    return hash !== undefined || !!error
  }

  async function writeChanges(): Promise<boolean> {
    const doc = toValue(pdfDocument)
    const { hash, isImageLoading, error } = getChanges()
    if (error) {
      // Emitting nothing new would let a save take the old content, the file stays changed.
      markChanged()
      throw error
    }
    if (hash === undefined) {
      // Checked again once the image is there, nothing else reports it.
      if (isImageLoading) {
        startCheckTimer()
      }
      return false
    }
    if (hash === saved?.hash) {
      emittedHash = hash
      emit(saved.content)
      return true
    }

    // With an empty storage (e.g. every new annotation was removed again) the original
    // bytes are the correct result, saveDocument() would only warn about it.
    const bytes = hash ? await doc.saveDocument() : await doc.getData()
    if (doc !== toValue(pdfDocument)) {
      return false
    }
    emittedHash = hash
    // WebDAV expects a plain ArrayBuffer of exactly the file, a copy only if it is a part of one.
    const isWholeBuffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    emit(isWholeBuffer ? (bytes.buffer as ArrayBuffer) : bytes.slice().buffer)

    // Edits that landed while the worker was busy are picked up by another round.
    if (readStorage(doc).hash !== emittedHash) {
      startCheckTimer()
    }
    return true
  }

  /** Emits pending changes right away. Resolves to true if new content was emitted. */
  async function flush(): Promise<boolean> {
    cancelCheck()
    // Let a running save finish first, then check whether anything is still pending. A loop,
    // because several callers may be waiting for the same running save. Its failure is reported
    // by its own caller, this one gets its own result.
    while (runningFlush) {
      await runningFlush.catch(() => {})
    }
    runningFlush = writeChanges().finally(() => {
      runningFlush = undefined
    })
    return runningFlush
  }

  // AppWrapper decides about unsaved changes right away when the app gets closed, saved with
  // its button or a download starts, while writing the content takes a moment. So once the
  // user reaches for something outside the app, finish the editing and report the change.
  useEventListener(
    window,
    'pointerdown',
    (event: PointerEvent) => {
      const target = event.target as Element
      if (
        !toValue(isEnabled) ||
        toValue(root)?.contains(target) ||
        target.closest?.('.oc-modal, [data-tippy-root], .oc-bottom-drawer')
      ) {
        return
      }
      commitEditing()
      if (!hasPendingChanges()) {
        return
      }
      markChanged()
      flush().catch(onError)
    },
    { capture: true }
  )

  // Interactions inside the app: the first one starts the tracking, each may have changed
  // something.
  useEventListener(root, ['pointerdown', 'keydown', 'beforeinput', 'drop'], () => startTracking(), {
    capture: true
  })
  // Values can also come without a key or click, e.g. from autofill or dictation, but always
  // into a focused field. Not on any focus, the pages get it when the document opens.
  useEventListener(
    root,
    'focusin',
    (event: FocusEvent) => {
      if ((event.target as Element).matches?.('input, textarea, select, [contenteditable]')) {
        startTracking()
      }
    },
    { capture: true }
  )
  useEventListener(root, ['pointerup', 'keyup', 'change'], () => scheduleCheck())
  // Typing and drawing count as changes right away, also before PDF.js stores them.
  useEventListener(root, 'input', () => {
    scheduleCheck()
    if (toValue(isEnabled) && isTracking && hasUnfinishedEdits()) {
      markChanged()
    }
  })
  // After PDF.js' own handling on window: dragging an annotation looks like drawing until then.
  const { start: checkDrawing } = useTimeoutFn(
    () => {
      if (toValue(isEnabled) && isTracking && isDrawing()) {
        markChanged()
      }
    },
    0,
    { immediate: false }
  )
  useEventListener(root, 'pointerup', () => checkDrawing())

  /**
   * Whether a copy marked the file as changed since the last call, so a save in between (e.g.
   * with AppWrapper's button or autosave) may have taken it.
   */
  function takeChangeMarker() {
    const hadMarker = hasEmittedMarker
    hasEmittedMarker = false
    return hadMarker
  }

  return { scheduleCheck, flush, reset, takeChangeMarker, markChanged, markSaved }
}
