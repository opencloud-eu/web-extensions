import { ActionExtension } from '@opencloud-eu/web-pkg'
import { computed, unref } from 'vue'
import { useUnzipAction } from './useUnzipAction'

export const useExtensions = () => {
  const action = useUnzipAction()

  const actionExtension = computed<ActionExtension>(() => {
    return {
      id: 'com.github.opencloud-eu.web-extensions.extract-archive',
      type: 'action',
      extensionPointIds: ['global.files.context-actions'],
      action: unref(action)
    }
  })

  return computed(() => [unref(actionExtension)])
}
