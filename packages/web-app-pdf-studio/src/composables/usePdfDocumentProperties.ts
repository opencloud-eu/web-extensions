import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { createGlobalState } from '@vueuse/core'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Resource } from '@opencloud-eu/web-client'
import { useSideBar } from '@opencloud-eu/web-pkg'
import { getDocumentProperties, type DocumentProperties } from '../helpers/documentProperties'

export const documentPropertiesPanelName = 'pdf-studio-document-properties'

/**
 * What the panel in the right sidebar shows. The sidebar belongs to the AppWrapper, so the open
 * document shares its properties through this.
 */
export const useDocumentPropertiesPanelState = createGlobalState(() => ({
  resourceId: ref<string>(),
  properties: shallowRef<DocumentProperties>()
}))

/**
 * The document properties of the PDF.js viewer, for the current page and rotation, in a panel of
 * the right sidebar.
 */
export function usePdfDocumentProperties({
  pdfDocument,
  resource,
  pageNumber,
  rotation
}: {
  pdfDocument: MaybeRefOrGetter<PDFDocumentProxy | undefined>
  resource: MaybeRefOrGetter<Resource>
  pageNumber: MaybeRefOrGetter<number>
  rotation: MaybeRefOrGetter<number>
}) {
  const sideBarStore = useSideBar()
  const { resourceId, properties } = useDocumentPropertiesPanelState()

  // Hiding the sidebar keeps the active panel.
  const isPanelShown = computed(
    () =>
      sideBarStore.isSideBarOpen && sideBarStore.sideBarActivePanel === documentPropertiesPanelName
  )

  watch(
    () => toValue(resource).id,
    (id) => {
      resourceId.value = id
    },
    { immediate: true }
  )

  // Only while shown, they follow the current page and rotation like in the PDF.js viewer.
  watch(
    [isPanelShown, () => toValue(pdfDocument), () => toValue(pageNumber), () => toValue(rotation)],
    async ([isShown, doc, page, pageRotation], [, oldDoc], onCleanup) => {
      // Not the ones of another document, e.g. after reloading it.
      if (doc !== oldDoc) {
        properties.value = undefined
      }
      if (!isShown || !doc) {
        return
      }
      let isStale = false
      onCleanup(() => {
        isStale = true
      })
      const result = await getDocumentProperties(doc, {
        pageNumber: page,
        rotation: pageRotation,
        locale: navigator.language
      })
      if (!isStale) {
        properties.value = result
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    resourceId.value = undefined
    properties.value = undefined
  })

  function showProperties() {
    sideBarStore.openSideBarPanel(documentPropertiesPanelName)
  }

  return { showProperties }
}
