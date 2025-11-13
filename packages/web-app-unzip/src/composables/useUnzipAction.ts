import {
  dirname,
  FileAction,
  FileActionOptions,
  formatFileSize,
  OcMinimalUppyFile,
  resolveFileNameDuplicate,
  UppyService,
  useClientService,
  useLoadingService,
  useMessages,
  useResourcesStore,
  useService,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { extractNameWithoutExtension, urlJoin } from '@opencloud-eu/web-client'
import * as uuid from 'uuid'
import * as zip from '@zip.js/zip.js'
import workerUrl from '@zip.js/zip.js/dist/zip-web-worker.js?worker&url'
import untar from 'js-untar'
import pako from 'pako'

const SUPPORTED_MIME_TYPES = [
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-compressed-tar',
  'application/x-bzip2',
  'application/x-bzip'
]
const MAX_SIZE_MB = 1024 // in mb (1GB)

export const useUnzipAction = () => {
  const { $gettext, current: currentLanguage } = useGettext()
  const clientService = useClientService()
  const loadingService = useLoadingService()
  const userStore = useUserStore()
  const resourcesStore = useResourcesStore()
  const { showErrorMessage } = useMessages()
  const uppyService = useService<UppyService>('$uppyService')

  const createRootFolder = async ({ space, resources }: FileActionOptions) => {
    const archiveName = extractNameWithoutExtension(resources[0])
    let folderName = archiveName
    if (resourcesStore.resources.some((r) => r.isFolder && r.name === folderName)) {
      folderName = resolveFileNameDuplicate(archiveName, '', resourcesStore.resources)
    }
    const path = urlJoin(resourcesStore.currentFolder.path, folderName)
    const resource = await clientService.webdav.createFolder(unref(space), { path })
    resourcesStore.upsertResource(resource)
    return resource
  }

  const getFileBlob = async ({ space, resources }: FileActionOptions) => {
    const { response } = await clientService.webdav.getFileContents(
      space,
      { path: resources[0].path },
      { responseType: 'blob' }
    )
    return new File([response.data], resources[0].name)
  }

  const getArchiveType = (fileName: string, mimeType: string): 'zip' | 'tar' | 'tar.gz' | 'tar.bz2' | null => {
    const lowerName = fileName.toLowerCase()
    const lowerMime = mimeType.toLowerCase()

    if (lowerMime === 'application/zip' || lowerName.endsWith('.zip')) {
      return 'zip'
    }
    if (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz') ||
        lowerMime.includes('gzip') || lowerMime.includes('x-compressed-tar')) {
      return 'tar.gz'
    }
    if (lowerName.endsWith('.tar.bz2') || lowerName.endsWith('.tbz2') ||
        lowerMime.includes('bzip')) {
      return 'tar.bz2'
    }
    if (lowerMime === 'application/x-tar' || lowerName.endsWith('.tar')) {
      return 'tar'
    }
    return null
  }

  const extractTarArchive = async (arrayBuffer: ArrayBuffer): Promise<OcMinimalUppyFile[]> => {
    const files = await untar(arrayBuffer)
    return files
      .filter((file) => file.type !== '5') // Filter out directories (type '5')
      .map((file) => {
        const path = dirname(file.name)
        const name = path === '.' ? file.name : file.name.substring(path.length + 1)

        return {
          name,
          data: new Blob([file.buffer]),
          meta: {
            ...(path !== '.' && { webkitRelativePath: file.name })
          }
        } as unknown as OcMinimalUppyFile
      })
  }

  const extractTarGzArchive = async (arrayBuffer: ArrayBuffer): Promise<OcMinimalUppyFile[]> => {
    // Decompress gzip first
    const decompressed = pako.ungzip(new Uint8Array(arrayBuffer))
    // Then extract tar
    return extractTarArchive(decompressed.buffer)
  }

  const extractZipArchive = async (fileBlob: File): Promise<OcMinimalUppyFile[]> => {
    let zipReader: zip.ZipReader<zip.BlobReader>

    try {
      zip.configure({
        chunkSize: 128,
        useWebWorkers: true,
        workerURI: workerUrl
      })

      const blobReader = new zip.BlobReader(fileBlob)
      zipReader = new zip.ZipReader(blobReader)
      const entries = await zipReader.getEntries()

      // password protected archives currently cannot be extracted
      if (entries.some(({ encrypted }) => encrypted)) {
        throw new Error('Password protected archives cannot be extracted')
      }

      // unzip and convert to UppyFile's
      const promises = entries
        .filter(({ filename }) => !filename.endsWith('/'))
        .map<Promise<OcMinimalUppyFile | void>>((result) => {
          const writer = new zip.BlobWriter()
          return (result as zip.FileEntry).getData(writer).then((data) => {
            const path = dirname(result.filename)
            const name = path === '.' ? result.filename : result.filename.substring(path.length + 1)

            return {
              name,
              data,
              meta: {
                ...(path !== '.' && { webkitRelativePath: urlJoin(path, name) })
              }
            } as unknown as OcMinimalUppyFile
          })
        })

      return (await Promise.all(promises)) as OcMinimalUppyFile[]
    } finally {
      if (zipReader) {
        zipReader.close()
      }
    }
  }

  const handler = async ({ space, resources }: FileActionOptions) => {
    try {
      const fileBlob = await getFileBlob({ space, resources })
      const archiveType = getArchiveType(resources[0].name, resources[0].mimeType)

      if (!archiveType) {
        showErrorMessage({
          title: $gettext('Unsupported archive format'),
          errors: [new Error()]
        })
        return
      }

      let filesToUpload: OcMinimalUppyFile[]

      // Extract based on archive type
      if (archiveType === 'zip') {
        filesToUpload = await extractZipArchive(fileBlob)
      } else if (archiveType === 'tar') {
        const arrayBuffer = await fileBlob.arrayBuffer()
        filesToUpload = await extractTarArchive(arrayBuffer)
      } else if (archiveType === 'tar.gz') {
        const arrayBuffer = await fileBlob.arrayBuffer()
        filesToUpload = await extractTarGzArchive(arrayBuffer)
      } else if (archiveType === 'tar.bz2') {
        showErrorMessage({
          title: $gettext('Bzip2 archives are not yet supported'),
          errors: [new Error()]
        })
        return
      } else {
        showErrorMessage({
          title: $gettext('Unsupported archive format'),
          errors: [new Error()]
        })
        return
      }

      const folder = await createRootFolder({ space, resources })
      const uploadId = uuid.v4()

      // Add uploadId to all files
      filesToUpload.forEach(file => {
        file.meta = { ...file.meta, uploadId }
      })

      uppyService.setUploadFolder(uploadId, folder)
      uppyService.addFiles(filesToUpload)
    } catch (error) {
      showErrorMessage({ title: $gettext('Failed to extract archive'), errors: [error] })
    }
  }

  const action = computed<FileAction>(() => {
    return {
      name: 'extract-archive',
      icon: 'inbox-unarchive',
      handler: (args) => loadingService.addTask(() => handler(args)),
      label: () => {
        return $gettext('Extract here')
      },
      isDisabled: ({ resources }) => {
        const archiveSize = Number(resources[0].size || 0)
        const maxSize = MAX_SIZE_MB * 1000000
        return archiveSize > maxSize
      },
      disabledTooltip: () =>
        $gettext('Archive exceeds the maximum size of %{maxSize}', {
          maxSize: formatFileSize(MAX_SIZE_MB * 1000000, currentLanguage)
        }),
      isVisible: ({ resources }) => {
        if (resources.length !== 1) {
          return false
        }
        if (!resourcesStore.currentFolder?.canUpload({ user: userStore.user })) {
          return false
        }
        // Check both mime type and file extension
        const fileName = resources[0].name.toLowerCase()
        const mimeType = resources[0].mimeType
        return SUPPORTED_MIME_TYPES.includes(mimeType) ||
               fileName.endsWith('.zip') ||
               fileName.endsWith('.tar') ||
               fileName.endsWith('.tar.gz') ||
               fileName.endsWith('.tgz') ||
               fileName.endsWith('.tar.bz2') ||
               fileName.endsWith('.tbz2')
      },
      componentType: 'button',
      class: 'oc-files-actions-extract-archive'
    }
  })

  return action
}
