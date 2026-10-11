import { ref, shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mock } from 'vitest-mock-extended'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { useModals, type Modal } from '@opencloud-eu/web-pkg'
import { AnnotationType, type AnnotationEditorUIManager, type PDFDocumentProxy } from 'pdfjs-dist'
import { usePdfComments } from '../../../src/composables/usePdfComments'
import type { CommentData, CommentTarget } from '../../../src/helpers/comments'

function comment(id: string, date: string, data: Partial<CommentData> = {}): CommentData {
  return {
    id,
    pageIndex: 0,
    rect: [0, 0, 10, 10],
    modificationDate: date,
    contentsObj: { str: `Comment ${id}` },
    ...data
  }
}

function createTarget(data: Partial<CommentData> = {}) {
  // On a page, PDF.js removes the button with the page's layers.
  const button = document.createElement('button')
  document.body.append(button)
  return {
    comment: null as unknown,
    elementBeforePopup: button,
    commentPopupPosition: [0.1, 0.1],
    commentButtonWidth: 0.02,
    parentBoundingClientRect: new DOMRect(0, 0, 1000, 1000),
    getData: () => comment('a', 'D:20260101', data),
    hasDefaultPopupPosition: () => true,
    setCommentButtonStates: vi.fn(),
    editComment: vi.fn(),
    focusCommentButton: vi.fn(),
    focus: vi.fn(),
    isSelected: false
  } satisfies CommentTarget
}

function setup({ isReadOnly = false } = {}) {
  const onChange = vi.fn()
  const getAnnotationsByType = vi.fn().mockResolvedValue([])
  const getAnnotations = vi.fn().mockResolvedValue([])
  const getPage = vi.fn().mockResolvedValue({ getAnnotations })
  const pdfDocument = shallowRef(mock<PDFDocumentProxy>({ getAnnotationsByType, getPage }))
  const getCommentButton = vi.fn().mockReturnValue(null)
  const uiManager = mock<AnnotationEditorUIManager>()
  uiManager.waitForEditorsRendered.mockResolvedValue(undefined)
  const goToXY = vi.fn()
  const getAnnotationComment = vi.fn().mockResolvedValue(null)
  let comments: ReturnType<typeof usePdfComments>
  let modals: ReturnType<typeof useModals>
  getComposableWrapper(() => {
    modals = useModals()
    comments = usePdfComments({
      pdfDocument,
      isReadOnly: ref(isReadOnly),
      onChange,
      getUiManager: () => uiManager,
      getAnnotationComment,
      getCommentButton,
      goToXY
    })
  })
  function lastModal() {
    return vi.mocked(modals.dispatchModal).mock.calls.at(-1)[0] as Modal
  }
  return {
    comments,
    onChange,
    uiManager,
    goToXY,
    getAnnotationComment,
    getAnnotationsByType,
    getAnnotations,
    getPage,
    getCommentButton,
    pdfDocument,
    lastModal
  }
}

describe('usePdfComments', () => {
  describe('list', () => {
    it('lists comments with text, newest first, while the comments tool is active', () => {
      const { comments } = setup()
      const { commentManager } = comments
      commentManager.showSidebar([
        comment('old', 'D:20250101'),
        comment('new', 'D:20260101'),
        comment('empty', 'D:20260201', { contentsObj: { str: '' } })
      ])
      expect(comments.comments.value.map(({ id }) => id)).toEqual(['new', 'old'])
      commentManager.hideSidebar()
      expect(comments.comments.value).toBeUndefined()
    })

    it('orders like PDF.js: last changed first, then by page and position', () => {
      const { comments } = setup()
      comments.commentManager.showSidebar([
        comment('page2', 'D:20260101', { pageIndex: 1 }),
        comment('lower', 'D:20260101', { rect: [0, 0, 10, 5] }),
        comment('upper', 'D:20260101', { rect: [0, 0, 10, 50] }),
        comment('newest', 'D:20260301')
      ])
      expect(comments.comments.value.map(({ id }) => id)).toEqual([
        'newest',
        'upper',
        'lower',
        'page2'
      ])
    })

    it('keeps the list up to date', () => {
      const { comments } = setup()
      const { commentManager } = comments
      commentManager.showSidebar([comment('a', 'D:20250101')])
      commentManager.updateComment(comment('b', 'D:20260101'))
      commentManager.updateComment(comment('a', 'D:20270101', { contentsObj: { str: 'Edited' } }))
      expect(comments.comments.value.map(({ id }) => id)).toEqual(['a', 'b'])
      expect(comments.comments.value[0].contentsObj.str).toBe('Edited')
      commentManager.removeComments(['a'])
      expect(comments.comments.value.map(({ id }) => id)).toEqual(['b'])
    })

    it('ignores updates while the list is not shown', () => {
      const { comments } = setup()
      comments.commentManager.updateComment(comment('a', 'D:20250101'))
      expect(comments.comments.value).toBeUndefined()
    })

    it('opens a comment of the list on its page', async () => {
      const { comments, uiManager, goToXY } = setup()
      await comments.openComment(comment('a', 'D:20250101', { pageIndex: 2, rect: [5, 0, 0, 7] }))
      expect(goToXY).toHaveBeenCalledWith(3, 5, 7)
      expect(uiManager.selectComment).toHaveBeenCalledWith(2, 'a')
      expect(comments.selectedCommentId.value).toBe('a')
    })

    // Without a tool, PDF.js has no editors for saved annotations.
    it('opens comments of saved annotations from the list', async () => {
      const { comments, getAnnotationComment } = setup()
      // A saved annotation's comment knows no id, its button follows the annotation.
      const target = {
        ...createTarget(),
        getData: () => comment('x', '', { id: undefined })
      }
      const annotation = document.createElement('section')
      annotation.dataset.annotationId = 'a'
      target.elementBeforePopup.before(annotation)
      getAnnotationComment.mockResolvedValue(target)
      await comments.openComment(comment('a', 'D:20250101', { pageIndex: 1 }))
      expect(getAnnotationComment).toHaveBeenCalledWith(1, 'a')
      expect(comments.popup.value).toEqual(expect.objectContaining({ target, isSelected: true }))
    })
  })

  describe('comments of annotations without an editor', () => {
    it('lists them with the ones of PDF.js, read-only', async () => {
      const { comments, getAnnotationsByType } = setup()
      const note = comment('note', 'D:20260301', { titleObj: { str: 'Jane' } })
      getAnnotationsByType.mockResolvedValue([
        note,
        comment('x', 'D:20260301', { contentsObj: { str: '' } })
      ])
      comments.commentManager.showSidebar([comment('a', 'D:20260101')])
      expect(comments.comments.value.map(({ id }) => id)).toEqual(['a'])
      await flushPromises()
      expect(comments.comments.value.map(({ id }) => id)).toEqual(['note', 'a'])
      expect(getAnnotationsByType.mock.calls[0][0]).toContain(AnnotationType.TEXT)
      expect(getAnnotationsByType.mock.calls[0][0]).not.toContain(AnnotationType.HIGHLIGHT)
    })

    it('shows the authors that the editors of saved annotations leave out', async () => {
      const { comments, getAnnotations, getPage } = setup()
      // Listed by the annotation's id, a new one has no annotation on the page.
      getAnnotations.mockResolvedValue([{ id: 'a', titleObj: { str: 'Jane' } }])
      comments.commentManager.showSidebar([
        comment('a', 'D:20260101', { pageIndex: 2 }),
        comment('b', 'D:20260201')
      ])
      await flushPromises()
      expect(getPage).toHaveBeenCalledWith(3)
      expect(comments.comments.value.map(({ titleObj }) => titleObj?.str)).toEqual([
        undefined,
        'Jane'
      ])
      // An edited comment keeps it, the editor reports none.
      comments.commentManager.updateComment(comment('a', 'D:20260301'))
      expect(comments.comments.value[0]).toMatchObject({ id: 'a', titleObj: { str: 'Jane' } })
    })

    it('lists sticky notes without a popup object, their text is the comment', async () => {
      const { comments, getAnnotationsByType } = setup()
      getAnnotationsByType.mockResolvedValue([comment('note', 'D:20260301')])
      comments.commentManager.showSidebar([])
      await flushPromises()
      expect(comments.comments.value.map(({ id }) => id)).toEqual(['note'])
    })

    it('looks them up once per document, the worker parses every page for it', async () => {
      const { comments, getAnnotationsByType, pdfDocument } = setup()
      comments.commentManager.showSidebar([])
      comments.commentManager.hideSidebar()
      comments.commentManager.showSidebar([])
      await flushPromises()
      expect(getAnnotationsByType).toHaveBeenCalledTimes(1)
      // E.g. after a page operation.
      pdfDocument.value = mock<PDFDocumentProxy>({ getAnnotationsByType })
      comments.commentManager.showSidebar([])
      await flushPromises()
      expect(getAnnotationsByType).toHaveBeenCalledTimes(2)
    })

    it('completes the newest list, with the edits made in the meantime', async () => {
      const { comments, getAnnotationsByType } = setup()
      const first = Promise.withResolvers<CommentData[]>()
      getAnnotationsByType.mockReturnValue(first.promise)
      comments.commentManager.showSidebar([comment('a', 'D:20260101')])
      comments.commentManager.hideSidebar()
      comments.commentManager.showSidebar([comment('b', 'D:20260101')])
      comments.commentManager.updateComment(comment('b', 'D:20260301'))
      comments.commentManager.removeComments(['x'])
      first.resolve([comment('note', 'D:20260201')])
      await flushPromises()
      expect(comments.comments.value.map(({ id }) => id)).toEqual(['b', 'note'])
      expect(comments.comments.value[0].modificationDate).toBe('D:20260301')
    })

    it('drops a completion that arrives after the list was hidden', async () => {
      const { comments, getAnnotationsByType } = setup()
      getAnnotationsByType.mockResolvedValue([comment('note', 'D:20260301')])
      comments.commentManager.showSidebar([comment('a', 'D:20260101')])
      comments.commentManager.hideSidebar()
      await flushPromises()
      expect(comments.comments.value).toBeUndefined()
    })

    it('opens them from the list through their button on the page', async () => {
      const { comments, getCommentButton } = setup()
      const button = document.createElement('button')
      const click = vi.spyOn(button, 'click')
      getCommentButton.mockReturnValue(button)
      await comments.openComment(comment('note', 'D:20260301', { pageIndex: 1 }))
      expect(getCommentButton).toHaveBeenCalledWith(1, 'note')
      expect(click).toHaveBeenCalled()
    })
  })

  describe('popup', () => {
    it('shows the author of a saved annotation edited by an editor', async () => {
      const { comments, getAnnotations } = setup()
      const target = { ...createTarget(), annotationElementId: '12R', pageIndex: 1 }
      getAnnotations.mockResolvedValue([{ id: '12R', titleObj: { str: 'Jane' } }])
      comments.commentManager.toggleCommentPopup(target, true)
      await flushPromises()
      expect(comments.popup.value.data.titleObj).toEqual({ str: 'Jane' })
    })

    it('shows the author of a saved annotation, PDF.js leaves it out', async () => {
      const { comments, getAnnotations } = setup()
      const target = createTarget({ id: undefined })
      target.elementBeforePopup.className = 'annotationCommentButton'
      const page = document.createElement('div')
      page.className = 'page'
      page.dataset.pageNumber = '2'
      const annotation = document.createElement('section')
      annotation.dataset.annotationId = 'a'
      page.append(annotation, target.elementBeforePopup)
      document.body.append(page)
      getAnnotations.mockResolvedValue([{ id: 'b' }, { id: 'a', titleObj: { str: 'Jane' } }])
      comments.commentManager.toggleCommentPopup(target, true)
      await flushPromises()
      expect(comments.popup.value.data.titleObj).toEqual({ str: 'Jane' })
      // Updates of the popup keep it.
      comments.commentManager.updatePopupColor(target)
      expect(comments.popup.value.data.titleObj).toEqual({ str: 'Jane' })
    })

    it('shows a preview on hover and opens it on click', () => {
      const { comments } = setup()
      const target = createTarget()
      comments.commentManager.toggleCommentPopup(target, false)
      expect(comments.popup.value).toEqual(expect.objectContaining({ isSelected: false }))
      comments.commentManager.toggleCommentPopup(target, true)
      expect(comments.popup.value).toEqual(expect.objectContaining({ isSelected: true }))
      expect(target.setCommentButtonStates).toHaveBeenLastCalledWith({
        selected: true,
        hasPopup: true
      })
      // Hovering away keeps the opened popup.
      comments.commentManager.toggleCommentPopup(target, false, false)
      expect(comments.popup.value).toBeDefined()
      // Clicking again closes it.
      comments.commentManager.toggleCommentPopup(target, true)
      expect(comments.popup.value).toBeUndefined()
    })

    it('offers no changes in read-only files', () => {
      const { comments } = setup({ isReadOnly: true })
      const target = { ...createTarget(), _uiManager: { deleteComment: vi.fn() } }
      comments.commentManager.toggleCommentPopup(target, true, undefined, true)
      expect(comments.popup.value.isEditable).toBe(false)
    })

    // PDF.js would lose changes of the others when saving.
    it.each([
      ['highlightAnnotation', true],
      ['inkAnnotation', true],
      ['underlineAnnotation', false],
      ['textAnnotation', false]
    ])('offers changes of comments on %s: %s', (annotationClass, isEditable) => {
      const { comments } = setup()
      const target = createTarget()
      const annotation = document.createElement('section')
      annotation.className = annotationClass
      target.elementBeforePopup.className = 'annotationCommentButton'
      target.elementBeforePopup.before(annotation)
      comments.commentManager.toggleCommentPopup(target, true, undefined, true)
      expect(comments.popup.value.isEditable).toBe(isEditable)
    })

    it('closes popups of pages PDF.js removed, previews work again', () => {
      const { comments } = setup()
      const removed = createTarget()
      comments.commentManager.toggleCommentPopup(removed, true)
      removed.elementBeforePopup.remove()
      const other = createTarget()
      comments.commentManager.toggleCommentPopup(other, false)
      expect(comments.popup.value.target).toBe(other)
    })

    it('gives the focus back to the comment button when closed', () => {
      const { comments } = setup()
      const target = createTarget()
      comments.commentManager.toggleCommentPopup(target, true)
      comments.closePopup()
      expect(comments.popup.value).toBeUndefined()
      expect(target.focusCommentButton).toHaveBeenCalled()
    })

    it('edits the comment in the dialog', () => {
      const { comments } = setup()
      const target = createTarget()
      comments.commentManager.toggleCommentPopup(target, true)
      comments.editPopupComment()
      expect(comments.popup.value).toBeUndefined()
      expect(target.editComment).toHaveBeenCalled()
    })

    it('deletes comments of editors with undo, others directly', () => {
      const { comments, onChange } = setup()
      const deleteComment = vi.fn()
      const editor = { ...createTarget(), comment: { text: 'Hi' }, _uiManager: { deleteComment } }
      comments.commentManager.toggleCommentPopup(editor, true)
      comments.deletePopupComment()
      expect(deleteComment).toHaveBeenCalledWith(editor, { text: 'Hi' })

      const element = { ...createTarget(), comment: 'Hi' as unknown }
      comments.commentManager.toggleCommentPopup(element, true)
      comments.deletePopupComment()
      expect(element.comment).toBeNull()
      expect(onChange).toHaveBeenCalledTimes(2)
    })
  })

  describe('dialog', () => {
    it.each([
      ['', 'Add comment'],
      ['Old', 'Edit comment']
    ])('writes the comment (existing: "%s")', (existing, title) => {
      const { comments, onChange, uiManager, lastModal } = setup()
      const target = createTarget({ contentsObj: { str: existing } })
      comments.commentManager.showDialog(uiManager, target)
      const modal = lastModal()
      expect(modal.title).toBe(title)
      // PDF.js' shortcuts (e.g. Backspace deletes) stay out of the dialog.
      expect(uiManager.removeEditListeners).toHaveBeenCalled()
      const { onSave } = modal.customComponentAttrs() as { onSave: (text: string) => void }
      onSave('New')
      expect(target.comment).toBe('New')
      expect(uiManager.addEditListeners).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalled()
    })

    it('resumes PDF.js when cancelled', () => {
      const { comments, uiManager, lastModal } = setup()
      comments.commentManager.showDialog(uiManager, createTarget())
      lastModal().onCancel()
      expect(uiManager.addEditListeners).toHaveBeenCalled()
    })
  })
})
