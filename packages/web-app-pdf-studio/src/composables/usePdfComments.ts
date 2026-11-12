import { markRaw, ref, shallowRef, toValue, unref, type MaybeRefOrGetter } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  AnnotationType,
  applyOpacity,
  CSSConstants,
  findContrastColor,
  type AnnotationEditorUIManager,
  type PDFDocumentProxy
} from 'pdfjs-dist'
import { useModals } from '@opencloud-eu/web-pkg'
import PdfCommentModal from '../components/PdfCommentModal.vue'
import {
  getAnnotationElement,
  getAnnotationLocation,
  getCommentDate,
  type CommentData,
  type CommentTarget
} from '../helpers/comments'
import { pauseEditShortcuts } from '../helpers/editShortcuts'
import { getEditorUiManager } from '../helpers/pdfjsInternals'

/**
 * Annotations with comments that PDF.js lists only for the ones its editors handle (highlights,
 * drawings, text, images). The others are listed here as well, read-only.
 */
const OTHER_COMMENT_TYPES = new Set<number>([
  AnnotationType.TEXT,
  AnnotationType.LINE,
  AnnotationType.SQUARE,
  AnnotationType.CIRCLE,
  AnnotationType.POLYGON,
  AnnotationType.POLYLINE,
  AnnotationType.UNDERLINE,
  AnnotationType.SQUIGGLY,
  AnnotationType.STRIKEOUT,
  AnnotationType.CARET,
  AnnotationType.FILEATTACHMENT
])

export type CommentPopup = {
  target: CommentTarget
  data: CommentData
  /** Opened by clicking, hovering only shows a preview. */
  isSelected: boolean
  isEditable: boolean
}

/**
 * Same order as the comments sidebar of the PDF.js viewer: last changed first (an edited
 * comment moves to the top), otherwise by page and from top to bottom, left to right.
 */
function compareComments(a: CommentData, b: CommentData) {
  const dateA = getCommentDate(a)?.getTime() ?? -Infinity
  const dateB = getCommentDate(b)?.getTime() ?? -Infinity
  return (
    dateB - dateA ||
    a.pageIndex - b.pageIndex ||
    b.rect[3] - a.rect[3] ||
    a.rect[0] - b.rect[0] ||
    b.rect[1] - a.rect[1] ||
    a.rect[2] - b.rect[2] ||
    (a.id ?? '').localeCompare(b.id ?? '')
  )
}

function hasText({ contentsObj, richText }: CommentData) {
  return !!(contentsObj?.str || richText?.str)
}

/** The id the list knows the comment by. Editors report it, saved annotations don't. */
function getCommentId(target: CommentTarget, { id }: CommentData) {
  return id ?? getAnnotationElement(target)?.dataset.annotationId
}

/**
 * PDF.js offers to edit comments of all annotations, but saves the changes only for the ones
 * it can edit itself: changes on e.g. underlines or sticky notes would get lost.
 */
function canSaveComment(target: CommentTarget) {
  if (getEditorUiManager(target)) {
    return true
  }
  return !!getAnnotationElement(target)?.matches(
    '.highlightAnnotation, .inkAnnotation, .freeTextAnnotation, .stampAnnotation'
  )
}

/**
 * PDF.js supports comments on annotations, but their dialog, popup and list are part of the
 * full PDF.js viewer only. This provides the same contract as its CommentManager, the UI is
 * built from OpenCloud components (see PdfCommentPopup and PdfCommentsDrop).
 */
export function usePdfComments({
  pdfDocument,
  isReadOnly,
  onChange,
  getUiManager,
  getAnnotationComment,
  getCommentButton,
  goToXY
}: {
  pdfDocument: MaybeRefOrGetter<PDFDocumentProxy | undefined>
  /** Comments can still be read, but not changed. */
  isReadOnly: MaybeRefOrGetter<boolean>
  onChange: () => void
  getUiManager: () => AnnotationEditorUIManager | undefined
  /** The comment of a saved annotation, PDF.js has no editors for them without a tool. */
  getAnnotationComment: (pageIndex: number, id: string) => Promise<CommentTarget | undefined>
  /** The button of a saved annotation's comment, for the ones PDF.js has no editor for. */
  getCommentButton: (pageIndex: number, id: string) => HTMLElement | null | undefined
  goToXY: (pageNumber: number, x: number, y: number) => void
}) {
  const { $gettext } = useGettext()
  const { dispatchModal } = useModals()

  // All comments of the document while PDF.js' comments tool is active.
  const comments = shallowRef<CommentData[]>()
  const selectedCommentId = ref<string>()
  const popup = shallowRef<CommentPopup>()

  // The list is completed asynchronously, a newer one (or none) makes that obsolete.
  let listVersion = 0

  function setComments(list: CommentData[] | undefined) {
    comments.value = list?.filter(hasText).sort(compareComments)
  }

  function clearComments() {
    listVersion++
    setComments(undefined)
  }

  /** The author of a saved annotation's comment, PDF.js' editors and popups leave it out. */
  async function getAuthor(
    location: ReturnType<typeof getAnnotationLocation>
  ): Promise<CommentData['titleObj'] | undefined> {
    const doc = toValue(pdfDocument)
    if (!doc || !location) {
      return undefined
    }
    const page = await doc.getPage(location.pageNumber)
    const annotations = (await page.getAnnotations()) as CommentData[]
    return annotations.find(({ id }) => id === location.id)?.titleObj
  }

  /**
   * The authors of listed comments of saved annotations: PDF.js' editors of them report the
   * annotation's id, but no author.
   */
  async function getAuthors(list: CommentData[]) {
    const authors = new Map<string, CommentData['titleObj']>()
    await Promise.all(
      list.map(async ({ id, pageIndex, titleObj }) => {
        if (!id || titleObj) {
          return
        }
        const author = await getAuthor({ pageNumber: pageIndex + 1, id })
        if (author?.str) {
          authors.set(id, author)
        }
      })
    )
    return authors
  }

  // Per document, like PDF.js does for its own: the worker parses every page for it. A page
  // operation gives a new document, and the app can't change these comments.
  let otherComments: { doc: PDFDocumentProxy; promise: Promise<CommentData[]> } | undefined

  /** The comments of annotations PDF.js has no editor for, e.g. sticky notes. */
  function getOtherComments() {
    const doc = toValue(pdfDocument)
    if (!doc) {
      return Promise.resolve([])
    }
    if (otherComments?.doc !== doc) {
      otherComments = {
        doc,
        promise: doc
          .getAnnotationsByType(OTHER_COMMENT_TYPES, new Set())
          .then((others) => (others ?? []) as CommentData[])
      }
    }
    return otherComments.promise
  }

  /** PDF.js lists the comments of its editors, the ones of other annotations join them. */
  async function showSidebar(list: CommentData[] | undefined) {
    const version = ++listVersion
    setComments(list)
    if (!list) {
      return
    }
    const [others, authors] = await Promise.all([
      getOtherComments().catch((): CommentData[] => {
        // Tried again next time.
        otherComments = undefined
        return []
      }),
      getAuthors(list).catch(() => new Map<string, CommentData['titleObj']>())
    ])
    if (version !== listVersion) {
      return
    }
    // Edits in the meantime are in the current list.
    const current = (unref(comments) ?? []).map((data) =>
      authors.has(data.id) ? { ...data, titleObj: authors.get(data.id) } : data
    )
    setComments([...current, ...others])
  }

  async function addAuthor(target: CommentTarget) {
    const titleObj = await getAuthor(getAnnotationLocation(target)).catch(
      (): undefined => undefined
    )
    const current = unref(popup)
    if (titleObj?.str && current?.target === target) {
      popup.value = { ...current, data: { ...current.data, titleObj } }
    }
  }

  function hidePopup() {
    unref(popup)?.target.setCommentButtonStates({ selected: false, hasPopup: false })
    popup.value = undefined
    selectedCommentId.value = undefined
  }

  /**
   * PDF.js removes the layers of pages far away from the visible ones, popups on them go away
   * as well, otherwise they would keep hovering of other comments from showing previews.
   */
  function hidePopupOfRemovedPage() {
    if (unref(popup) && !unref(popup).target.elementBeforePopup.isConnected) {
      hidePopup()
    }
  }

  /** Closes the popup and gives the focus back to the comment's button. */
  function closePopup() {
    const target = unref(popup)?.target
    hidePopup()
    target?.focusCommentButton()
  }

  /** Same semantics as `toggle()` of the PDF.js viewer's popup. */
  function togglePopup(
    target: CommentTarget | null,
    isSelected: boolean,
    visibility?: boolean,
    isEditable = true
  ) {
    hidePopupOfRemovedPage()
    const current = unref(popup)
    if (!target) {
      hidePopup()
      return
    }
    if (isSelected) {
      visibility ??= current?.target === target ? !current.isSelected : true
    } else {
      // Hovering doesn't replace a popup opened by clicking.
      if (current?.isSelected) {
        return
      }
      visibility ??= !current
    }
    if (!visibility) {
      hidePopup()
      return
    }
    if (current && current.target !== target) {
      current.target.setCommentButtonStates({ selected: false, hasPopup: false })
    }
    target.setCommentButtonStates({ selected: isSelected, hasPopup: true })
    const data = target.getData()
    popup.value = {
      target,
      data,
      isSelected,
      // PDF.js offers to edit comments of other annotations also in read-only files.
      isEditable: isEditable && !toValue(isReadOnly) && canSaveComment(target)
    }
    if (isSelected) {
      selectedCommentId.value = getCommentId(target, data)
    }
    // The author of a saved annotation shows up once looked up, new ones have none.
    if (!data.titleObj) {
      addAuthor(target)
    }
  }

  function editPopupComment() {
    const { target } = unref(popup)
    hidePopup()
    target.editComment({ height: 0 })
  }

  function deletePopupComment() {
    const { target } = unref(popup)
    const savedData = target.comment as { text?: string } | null
    const uiManager = getEditorUiManager(target)
    hidePopup()
    // Editors delete with undo, comments of other annotations are just emptied.
    if (savedData?.text && uiManager) {
      uiManager.deleteComment(target as never, savedData)
    } else {
      target.comment = null
    }
    target.focus?.()
    onChange()
  }

  function showDialog(uiManager: AnnotationEditorUIManager | null, target: CommentTarget) {
    const comment = target.getData().contentsObj?.str ?? ''
    // `uiManager` is missing for comments of annotations that can't be edited.
    const resume = uiManager ? pauseEditShortcuts(uiManager, target) : () => {}
    dispatchModal({
      elementClass: 'pdf-studio-comment-modal',
      title: comment ? $gettext('Edit comment') : $gettext('Add comment'),
      confirmText: comment ? $gettext('Save') : $gettext('Add'),
      confirmDisabled: true,
      focusTrapInitial: '.pdf-studio-comment-input textarea',
      customComponent: markRaw(PdfCommentModal),
      customComponentAttrs: () => ({
        comment,
        onSave: (text: string) => {
          target.comment = text
          resume()
          target.focusCommentButton()
          onChange()
        }
      }),
      onCancel: () => {
        resume()
        target.focusCommentButton()
      }
    })
  }

  /** Shows a comment of the list on its page and opens it. */
  async function openComment({ id, pageIndex, rect }: CommentData) {
    hidePopup()
    const uiManager = getUiManager()
    const isRendered = uiManager?.waitForEditorsRendered(pageIndex + 1)
    goToXY(pageIndex + 1, rect[0], rect[3])
    if (!id) {
      return
    }
    selectedCommentId.value = id
    await isRendered
    // Finds editors only, e.g. while a tool is active.
    uiManager?.selectComment(pageIndex, id)
    if (!unref(popup)) {
      const target = await getAnnotationComment(pageIndex, id)
      if (target) {
        togglePopup(target, true)
      } else {
        // Annotations without an editor, PDF.js opens their comments through the button.
        getCommentButton(pageIndex, id)?.click()
      }
    }
  }

  function updateComment(annotation: CommentData) {
    const list = unref(comments)
    if (list) {
      // The editor reports no author, the one looked up stays.
      const titleObj = list.find(({ id }) => id === annotation.id)?.titleObj
      setComments([...list.filter(({ id }) => id !== annotation.id), { ...annotation, titleObj }])
    }
  }

  const commentManager = {
    // PDF.js points the `aria-controls` of comment buttons at the dialog. Ours is a modal that
    // only exists while open, so it gets a stand-in.
    dialogElement: document.createElement('div'),
    setSidebarUiManager() {},
    showSidebar,
    hideSidebar: clearComments,
    updateComment,
    removeComments(ids: string[]) {
      const list = unref(comments)
      if (list) {
        setComments(list.filter(({ id }) => !ids.includes(id)))
      }
    },
    toggleCommentPopup: togglePopup,
    destroyPopup: hidePopup,
    updatePopupColor(target: CommentTarget) {
      const current = unref(popup)
      if (current?.target === target) {
        popup.value = { ...current, data: { ...target.getData(), titleObj: current.data.titleObj } }
      }
    },
    showDialog,
    // The background of PDF.js' comment buttons, same as in the PDF.js viewer.
    makeCommentColor(color: number[], opacity?: number) {
      return findContrastColor(
        applyOpacity(color, opacity ?? 1),
        CSSConstants.commentForegroundColor
      ) as string
    },
    destroy() {
      hidePopup()
      clearComments()
      otherComments = undefined
    }
  }

  return {
    commentManager,
    comments,
    selectedCommentId,
    popup,
    openComment,
    closePopup,
    hidePopup,
    hidePopupOfRemovedPage,
    editPopupComment,
    deletePopupComment
  }
}
