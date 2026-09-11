import { ActionExtension, ApplicationSetupOptions } from '@opencloud-eu/web-pkg'
import { computed, unref } from 'vue'
import { useUnzipAction } from './useUnzipAction'

export const useExtensions = (args: ApplicationSetupOptions) => {
  const action = useUnzipAction(args)

  const actionExtension = computed<ActionExtension>(() => {
    return {
      id: 'com.github.opencloud-eu.web-extensions.unzip-archive',
      type: 'action',
      extensionPointIds: ['global.files.context-actions'],
      action: unref(action)
    }
  })

  return computed(() => [unref(actionExtension)])
}
