<template>
  <div ref="studioRoot" class="pdf-studio ext:flex ext:size-full ext:flex-col">
    <pdf-toolbar
      v-if="pdfDocument"
      ref="toolbar"
      :page-number="pageNumber"
      :pages-count="pagesCount"
      :page-labels="pageLabels"
      :scale-value="scaleValue"
      :scale="scale"
      :scroll-mode="scrollMode"
      :spread-mode="spreadMode"
      :editor-mode="editorMode"
      :editing-states="undoStates"
      :editor-params="editorParams"
      :saved-signatures="savedSignatures"
      :can-annotate="canAnnotate"
      :are-tools-disabled="!uiManager"
      :is-sidebar-open="isSidebarOpen"
      :is-find-bar-open="isFindBarOpen"
      :is-printing="isPrinting"
      :can-present="canPresent"
      :is-hand-tool-active="isHandToolActive"
      :is-tool-active="isToolActive"
      @toggle-sidebar="toggleSidebar"
      @toggle-find-bar="toggleFindBar"
      @go-to-page="goToPage"
      @previous-page="previousPage"
      @next-page="nextPage"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @set-scale="setScale"
      @rotate="rotate"
      @print="print"
      @present="present"
      @show-properties="showProperties"
      @set-hand-tool="setHandTool"
      @undo="undoChange"
      @redo="redoChange"
      @select-tool="chooseTool"
      @add-image="addImage"
      @add-saved-signature="
        createEditor(AnnotationEditorType.SIGNATURE, getSavedSignatureParams($event))
      "
      @remove-saved-signature="removeSavedSignature"
      @update-param="updateEditorSetting"
      @open-tool-settings="finishDrawings"
      @set-scroll-mode="setScrollMode"
      @set-spread-mode="setSpreadMode"
    />
    <div class="ext:relative ext:flex ext:min-h-0 ext:flex-1">
      <pdf-sidebar
        v-if="isSidebarOpen && pdfDocument"
        :key="documentKey"
        v-model:view="sidebarView"
        :pdf-document="pdfDocument"
        :page-number="pageNumber"
        :page-labels="pageLabels"
        :rotation="rotation"
        :is-read-only="!canAnnotate"
        :is-processing="isProcessingPages"
        :last-action="lastPageAction"
        :attachments="attachments"
        @go-to-page="goToPage"
        @open-attachment="openAttachment"
        @delete-page="deletePage"
        @move-page="movePage"
      />
      <div
        ref="viewerArea"
        class="ext:relative ext:min-w-0 ext:flex-1 ext:bg-role-surface-container"
      >
        <div
          ref="viewerContainer"
          tabindex="-1"
          :inert="isProcessingPages"
          class="pdf-studio-viewer-container ext:absolute ext:inset-0 ext:overflow-auto ext:overscroll-contain ext:isolate"
          :class="[presentationClasses, handToolClasses]"
        >
          <div class="pdfViewer ext:text-black" />
          <div ref="viewerAlert" class="ext:sr-only" role="alert" aria-live="assertive" />
        </div>
        <pdf-find-bar
          v-if="isFindBarOpen"
          ref="findBar"
          v-model:query="findQuery"
          v-model:options="findOptions"
          class="ext:absolute ext:top-3 ext:z-30"
          :style="{ left: `${findBarLeft}px`, maxWidth: `calc(100% - ${findBarLeft}px - 1rem)` }"
          :find-result="findResult"
          @find="find"
          @close="closeFindBar"
        />
        <pdf-load-status
          :is-loading="isLoading"
          :has-error="!!loadError"
          :is-password-cancelled="isPasswordCancelled"
          @retry="load(currentContent)"
        />
      </div>
      <pdf-comments-drop
        ref="commentsDrop"
        :comments="comments"
        :selected-id="selectedCommentId"
        @open="openComment"
        @close="leaveTool"
      />
      <pdf-comment-popup
        v-if="commentPopup"
        :popup="commentPopup"
        @edit="editPopupComment"
        @delete="deletePopupComment"
        @close="closeCommentPopup"
        @dismiss="hideCommentPopup"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref, unref, useTemplateRef } from 'vue'
import { until, useElementBounding } from '@vueuse/core'
import { AnnotationEditorType, type PDFDocumentProxy } from 'pdfjs-dist'
import type { Resource } from '@opencloud-eu/web-client'
import '@opencloud-eu/extension-sdk/tailwind.css'
import 'pdfjs-dist/web/pdf_viewer.css'
import '../styles/pdfjs-integration.css'
import '../styles/print.css'
import { pdfEventBusKey, usePdfViewer } from '../composables/usePdfViewer'
import { usePdfDocument } from '../composables/usePdfDocument'
import { usePdfSaving } from '../composables/usePdfSaving'
import { usePdfPageOperations } from '../composables/usePdfPageOperations'
import { usePdfPrint } from '../composables/usePdfPrint'
import { usePdfCloudImagePicker } from '../composables/usePdfCloudImagePicker'
import { usePdfAltText } from '../composables/usePdfAltText'
import { getSavedSignatureParams, usePdfSignature } from '../composables/usePdfSignature'
import { usePdfSignatureStorage } from '../composables/usePdfSignatureStorage'
import { usePdfComments } from '../composables/usePdfComments'
import { usePdfShortcuts } from '../composables/usePdfShortcuts'
import { usePdfFindBar } from '../composables/usePdfFindBar'
import { usePdfPresentationMode } from '../composables/usePdfPresentationMode'
import { usePdfHandTool } from '../composables/usePdfHandTool'
import { usePdfDocumentProperties } from '../composables/usePdfDocumentProperties'
import { pdfOutlineKey, usePdfOutline } from '../composables/usePdfOutline'
import { pdfLayersKey, usePdfLayers } from '../composables/usePdfLayers'
import { usePdfPageLabels } from '../composables/usePdfPageLabels'
import { pdfThumbnailCacheKey, usePdfThumbnailCache } from '../composables/usePdfThumbnailCache'
import { usePdfAttachments } from '../composables/usePdfAttachments'
import { getInitialView, type SidebarView } from '../helpers/initialView'
import PdfToolbar from './PdfToolbar.vue'
import PdfFindBar from './PdfFindBar.vue'
import PdfSidebar from './PdfSidebar.vue'
import PdfLoadStatus from './PdfLoadStatus.vue'
import PdfCommentsDrop from './PdfCommentsDrop.vue'
import PdfCommentPopup from './PdfCommentPopup.vue'

const { resource, currentContent, isReadOnly, isDirty } = defineProps<{
  resource: Resource
  currentContent: ArrayBuffer
  isReadOnly: boolean
  isDirty: boolean
}>()

const emit = defineEmits<{
  'update:currentContent': [content: ArrayBuffer]
  save: []
  /** AppWrapper calls it after each of its saves. */
  'register:onSaveCallback': [callback: () => Promise<void>]
}>()

const studioRoot = useTemplateRef<HTMLDivElement>('studioRoot')
const viewerContainer = useTemplateRef<HTMLDivElement>('viewerContainer')
const toolbar = useTemplateRef<InstanceType<typeof PdfToolbar>>('toolbar')
const findBar = useTemplateRef<InstanceType<typeof PdfFindBar>>('findBar')
const commentsDrop = useTemplateRef<InstanceType<typeof PdfCommentsDrop>>('commentsDrop')
const isSidebarOpen = ref(false)
const sidebarView = ref<SidebarView>('pages')

function toggleSidebar() {
  isSidebarOpen.value = !unref(isSidebarOpen)
}

// The managers are needed by the viewer, which comes first. Changing image or signature
// descriptions is a change of the document as well.
const { altTextManager } = usePdfAltText({ onChange: () => scheduleChangeCheck() })
const {
  signatures: savedSignatures,
  remove: removeSavedSignature,
  ...signatureStorage
} = usePdfSignatureStorage()
const { signatureManager } = usePdfSignature({
  storage: signatureStorage,
  onChange: () => scheduleChangeCheck(),
  // Without a signature the tool is no use.
  onCancel: () => leaveTool()
})
const {
  commentManager,
  comments,
  selectedCommentId,
  popup: commentPopup,
  openComment,
  closePopup: closeCommentPopup,
  hidePopup: hideCommentPopup,
  hidePopupOfRemovedPage,
  editPopupComment,
  deletePopupComment
} = usePdfComments({
  isReadOnly: () => isReadOnly,
  onChange: () => scheduleChangeCheck(),
  getUiManager: () => unref(uiManager),
  getAnnotationComment: (pageIndex, id) => getAnnotationComment(pageIndex, id),
  goToXY: (pageNumber, x, y) => linkService.goToXY(pageNumber, x, y, { center: 'both' })
})

const {
  viewer,
  eventBus,
  linkService,
  downloadManager,
  scriptingManager,
  uiManager,
  pagesCount,
  pageNumber,
  scaleValue,
  scale,
  rotation,
  editorMode,
  isToolActive,
  editingStates,
  editorParams,
  setDocument,
  goToPage,
  nextPage,
  previousPage,
  setScale,
  zoomIn,
  zoomOut,
  zoomAt,
  panBy,
  scrollMode,
  spreadMode,
  setScrollMode,
  setSpreadMode,
  rotate,
  createEditor,
  leaveTool,
  selectTool,
  handleEscape,
  isDrawing,
  hasUnfinishedEdits,
  finishDrawings,
  commitEditing,
  updateEditorSetting,
  undo,
  redo,
  getAnnotationComment
} = usePdfViewer({
  container: viewerContainer,
  viewerAlert: useTemplateRef<HTMLDivElement>('viewerAlert'),
  isReadOnly: () => isReadOnly,
  altTextManager,
  signatureManager,
  commentManager
})

const { pdfDocument, documentKey, isLoading, loadError, isPasswordCancelled, load, getPassword } =
  usePdfDocument({
    onLoaded(doc, options) {
      resetChangeTracking()
      setDocument(doc, options)
      applyInitialView(doc)
    }
  })

// Once when the file is opened, not after page operations, like the PDF.js viewer.
let hasInitialView = false
async function applyInitialView(doc: PDFDocumentProxy) {
  if (hasInitialView) {
    return
  }
  hasInitialView = true
  const { sidebarView: view, spreadMode } = await getInitialView(doc)
  if (view) {
    sidebarView.value = view
    isSidebarOpen.value = true
  }
  if (spreadMode !== undefined) {
    setSpreadMode(spreadMode)
  }
}

const { attachments, openAttachment } = usePdfAttachments({
  eventBus,
  pdfDocument,
  linkService,
  downloadManager
})

provide(pdfEventBusKey, eventBus)
provide(pdfLayersKey, usePdfLayers({ viewer, eventBus }))
const { pageLabels } = usePdfPageLabels({ viewer, eventBus })

const thumbnailCache = usePdfThumbnailCache()
provide(pdfThumbnailCacheKey, thumbnailCache)

// Lives as long as the document, the sidebar keeps its state while it is closed.
provide(pdfOutlineKey, usePdfOutline({ pdfDocument, pageNumber, linkService, openAttachment }))

// PDF.js can't edit XFA forms (only fill them in) and writes nothing for read-only files.
const canAnnotate = computed(() => !isReadOnly && !unref(pdfDocument)?.isPureXfa)

const {
  scheduleCheck: scheduleChangeCheck,
  flush,
  reset: resetChangeTracking,
  afterSave,
  save
} = usePdfSaving({
  pdfDocument,
  root: studioRoot,
  eventBus,
  isEnabled: () => !unref(isProcessingPages),
  isReadOnly: () => isReadOnly,
  isDirty: () => isDirty,
  content: () => currentContent,
  editing: {
    editorMode,
    editingStates,
    isDrawing,
    hasUnfinishedEdits,
    finishDrawings,
    commitEditing
  },
  scripting: scriptingManager,
  onChange: (content) => emit('update:currentContent', content),
  onSave: () => emit('save')
})
emit('register:onSaveCallback', afterSave)

// Scrolling far away removes the layers of pages, including an open comment.
eventBus.on('updateviewarea', hidePopupOfRemovedPage)

const {
  isProcessing: isProcessingPages,
  lastAction: lastPageAction,
  deletePage,
  movePage,
  undoStates,
  undo: undoChange,
  redo: redoChange
} = usePdfPageOperations({
  pdfDocument,
  edits: { states: editingStates, undo, redo },
  getContent: () => currentContent,
  getPageNumber: () => unref(pageNumber),
  getPassword,
  // A drawing becomes part of the document once finished, which clicking a page action doesn't
  // do in every browser (Safari).
  beforeChange: () => {
    finishDrawings()
    return flush()
  },
  async onDocumentChanged(content, nextPageNumber, previousPageNumbers) {
    thumbnailCache.remap(previousPageNumbers)
    emit('update:currentContent', content)
    await load(content, { pageNumber: nextPageNumber })
  }
})

const {
  isFindBarOpen,
  findQuery,
  findOptions,
  findResult,
  find,
  findAgain,
  openFindBar,
  closeFindBar,
  toggleFindBar
} = usePdfFindBar({
  eventBus,
  findBar,
  onClose: () => unref(toolbar)?.focusFindToggle()
})

// Below the find button, like in the PDF.js viewer, but within the pages.
const { left: findToggleLeft } = useElementBounding(() => unref(toolbar)?.findToggleElement)
const { left: viewerAreaLeft } = useElementBounding(useTemplateRef<HTMLElement>('viewerArea'))
const findBarLeft = computed(() => Math.max(16, unref(findToggleLeft) - unref(viewerAreaLeft)))

const {
  isSupported: canPresent,
  isActive: isPresenting,
  containerClasses: presentationClasses,
  request: present
} = usePdfPresentationMode({ container: viewerContainer, viewer, eventBus })

const {
  isActive: isHandToolActive,
  containerClasses: handToolClasses,
  setChosen: setHandTool
} = usePdfHandTool({ container: viewerContainer, isToolActive, isPresenting, leaveTool })

const { showProperties } = usePdfDocumentProperties({
  pdfDocument,
  resource: () => resource,
  pageNumber,
  rotation
})

// Includes text being typed and drawings, like saving.
const { isPrinting, print } = usePdfPrint({
  pdfDocument,
  eventBus,
  scriptingManager,
  beforePrint: commitEditing
})

const { openPicker } = usePdfCloudImagePicker({
  resource: () => resource,
  onImage: (file) => createEditor(AnnotationEditorType.STAMP, { bitmapFile: file })
})

function addImage(source: 'device' | 'cloud') {
  if (source === 'cloud') {
    openPicker()
    return
  }
  // PDF.js asks for an image file.
  createEditor(AnnotationEditorType.STAMP)
}

function chooseTool(mode: number) {
  // PDF.js provides the comments while its comments tool is active. The button brings their list
  // back after it made room for a comment.
  const drop = unref(commentsDrop)
  const isCommentsToolActive = !!unref(comments)
  if (drop && mode === AnnotationEditorType.POPUP && isCommentsToolActive && !drop.isShown) {
    drop.show()
    return
  }
  selectTool(mode)
}

usePdfShortcuts({
  root: studioRoot,
  container: viewerContainer,
  isReadOnly: () => isReadOnly,
  isPresenting,
  isToolActive,
  editingStates,
  isPageFit: () => unref(scaleValue) === 'page-fit',
  isFindBarOpen,
  scale,
  actions: {
    save: () => save({ goOnTyping: true }),
    print,
    present,
    setHandTool,
    toggleSidebar,
    openFindBar,
    closeFindBar,
    selectPageNumber: () => unref(toolbar)?.selectPageNumber(),
    findAgain,
    zoomIn,
    zoomOut,
    resetZoom: () => setScale('auto'),
    zoomAt,
    panBy,
    undo: undoChange,
    redo: redoChange,
    nextPage,
    previousPage,
    firstPage: () => goToPage(1),
    lastPage: () => goToPage(unref(pagesCount)),
    rotate,
    handleEscape
  }
})

onMounted(async () => {
  // The app can be opened before AppWrapper has fetched the content.
  load(await until(() => currentContent).toBeTruthy())
})
</script>
