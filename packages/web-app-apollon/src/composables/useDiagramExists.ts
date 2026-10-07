import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type * as Y from 'yjs'
import { hasModelInYDoc } from '@tumaet/apollon/model'

export function useDiagramExists(ydoc: MaybeRefOrGetter<Y.Doc | null>) {
  const diagramExists = ref(false)
  let stopObserving: (() => void) | null = null

  function observe(doc: Y.Doc | null) {
    stopObserving?.()
    stopObserving = null
    diagramExists.value = false
    if (!doc) {
      return
    }
    function update() {
      diagramExists.value = hasModelInYDoc(doc)
    }
    doc.on('update', update)
    stopObserving = () => doc.off('update', update)
    update()
  }

  watch(() => toValue(ydoc), observe, { immediate: true })
  onScopeDispose(() => stopObserving?.())

  return { diagramExists }
}
