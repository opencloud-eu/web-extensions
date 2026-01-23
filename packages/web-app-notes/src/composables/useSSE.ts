import { useCapabilityStore, useClientService } from '@opencloud-eu/web-pkg'
import { MESSAGE_TYPE } from '@opencloud-eu/web-client/sse'
import { useLoadToc } from './useLoadToc'
import { z } from 'zod'

// eventSchema copied from web-runtime
const eventSchema = z.object({
  itemid: z.string().optional(),
  parentitemid: z.string().optional(),
  spaceid: z.string().optional(),
  initiatorid: z.string().optional(),
  etag: z.string().optional(),
  affecteduserids: z.array(z.string()).optional().nullable()
})

export const useSSE = () => {
  const clientService = useClientService()
  const capabilityStore = useCapabilityStore()
  const { loadToc } = useLoadToc()

  const onFileCreated = (msg: MessageEvent) => {
    const sseData = eventSchema.parse(JSON.parse(msg.data))
    if (sseData.initiatorid === clientService.initiatorId) {
      // we have our own handler for sparse inserts into toc store
      return
    }
    return loadToc()
  }
  const onFolderCreated = (msg: MessageEvent) => {
    const sseData = eventSchema.parse(JSON.parse(msg.data))
    if (sseData.initiatorid === clientService.initiatorId) {
      // we have our own handler for sparse inserts into toc store
      return
    }
    return loadToc()
  }
  const onResourceMoved = () => {
    return loadToc()
  }
  const onResourceRenamed = () => {
    return loadToc()
  }
  const onResourceRestored = () => {
    return loadToc()
  }
  const onResourceDeleted = () => {
    return loadToc()
  }

  const registerSSE = () => {
    if (!capabilityStore.supportSSE) {
      return
    }
    clientService.sseAuthenticated.addEventListener(MESSAGE_TYPE.FILE_TOUCHED, onFileCreated)
    clientService.sseAuthenticated.addEventListener(MESSAGE_TYPE.FOLDER_CREATED, onFolderCreated)
    clientService.sseAuthenticated.addEventListener(MESSAGE_TYPE.ITEM_MOVED, onResourceMoved)
    clientService.sseAuthenticated.addEventListener(MESSAGE_TYPE.ITEM_RENAMED, onResourceRenamed)
    clientService.sseAuthenticated.addEventListener(MESSAGE_TYPE.ITEM_RESTORED, onResourceRestored)
    clientService.sseAuthenticated.addEventListener(MESSAGE_TYPE.ITEM_TRASHED, onResourceDeleted)
  }
  const deregisterSSE = () => {
    if (!capabilityStore.supportSSE) {
      return
    }
    clientService.sseAuthenticated.removeEventListener(MESSAGE_TYPE.FILE_TOUCHED, onFileCreated)
    clientService.sseAuthenticated.removeEventListener(MESSAGE_TYPE.FOLDER_CREATED, onFolderCreated)
    clientService.sseAuthenticated.removeEventListener(MESSAGE_TYPE.ITEM_MOVED, onResourceMoved)
    clientService.sseAuthenticated.removeEventListener(MESSAGE_TYPE.ITEM_RENAMED, onResourceRenamed)
    clientService.sseAuthenticated.removeEventListener(
      MESSAGE_TYPE.ITEM_RESTORED,
      onResourceRestored
    )
    clientService.sseAuthenticated.removeEventListener(MESSAGE_TYPE.ITEM_TRASHED, onResourceDeleted)
  }

  return {
    registerSSE,
    deregisterSSE
  }
}
