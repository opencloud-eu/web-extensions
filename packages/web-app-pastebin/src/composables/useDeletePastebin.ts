import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { useClientService, useMessages, useModals } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'

export function useDeletePastebin() {
  const clientService = useClientService()
  const { showMessage, showErrorMessage } = useMessages()
  const { dispatchModal } = useModals()
  const { $gettext } = useGettext()

  function deletePastebin(
    space: SpaceResource,
    resource: Resource,
    displayName: string,
    onSuccess?: () => void | Promise<void>
  ) {
    dispatchModal({
      title: $gettext('Delete "%{name}"?', { name: displayName }),
      message: $gettext('This pastebin and all its files will be permanently deleted.'),
      confirmText: $gettext('Delete'),
      onConfirm: async () => {
        try {
          await clientService.webdav.deleteFile(space, { path: resource.path })
          showMessage({ title: $gettext('Pastebin deleted') })
          await onSuccess?.()
        } catch (err) {
          console.error('Failed to delete pastebin:', err)
          showErrorMessage({
            title: $gettext('Failed to delete pastebin'),
            errors: [err instanceof Error ? err : new Error(String(err))]
          })
        }
      }
    })
  }

  return { deletePastebin }
}
