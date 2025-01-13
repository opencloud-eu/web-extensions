import { ActionExtension, FileActionOptions, useClientService } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { computed, Ref, unref } from 'vue'
import { ApplicationSetupOptions } from '@ownclouders/web-pkg'

export const extensions = ({
  isAvailable
}: ApplicationSetupOptions & { isAvailable: Ref<boolean> }) => {
  const clientService = useClientService()
  const { $gettext } = useGettext()

  const handler = async ({ space, resources }: FileActionOptions) => {
    const resource = resources[0]

    const imageUrl = await clientService.webdav.getFileUrl(space, resource, {})
    const mimeType = resource.mimeType

    const castContext = cast.framework.CastContext.getInstance()
    let castSession = castContext.getCurrentSession()
    if (!castSession) {
      try {
        await castContext.requestSession()
        console.debug('Cast session initiated')
        castSession = castContext.getCurrentSession()
      } catch (e) {
        console.error('Could not initiate cast session', e)
      }
    }
    if (castSession) {
      const mediaInfo = new chrome.cast.media.MediaInfo(imageUrl, mimeType)
      const request = new chrome.cast.media.LoadRequest(mediaInfo)

      try {
        await castSession.loadMedia(request)
        console.debug('Resource Cast successful')
      } catch (e) {
        console.error('Error casting resource:', e)
      }
    } else {
      console.error('No Cast session available')
    }
  }

  const extension: ActionExtension = {
    id: 'com.github.opencloud-eu.cast.file-action',
    type: 'action',
    extensionPointIds: ['global.files.context-actions', 'global.files.default-actions'],
    action: {
      name: 'cast',
      icon: 'cast',
      category: 'context',
      handler,
      label: () => $gettext('Cast'),
      isVisible: ({ resources }: FileActionOptions) => {
        return unref(isAvailable) && !resources[0]?.isFolder
      }
    }
  }
  return computed(() => [extension])
}
