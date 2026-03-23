<template>
  <div class="ext:flex ext:flex-col ext:size-full">
    <div v-if="loading" class="ext:flex ext:items-center ext:justify-center ext:h-full">
      <oc-spinner size="medium" :aria-label="$gettext('Loading pastebin')" />
    </div>

    <div
      v-else-if="error || isReadOnly"
      class="ext:flex ext:flex-col ext:items-center ext:justify-center ext:h-full ext:text-center"
    >
      <h2 class="ext:text-[var(--oc-role-error)] ext:mb-4">
        {{ isReadOnly ? $gettext('Read-only') : $gettext('Failed to load') }}
      </h2>
      <p class="ext:text-[var(--oc-role-on-surface-variant)]">
        {{ isReadOnly ? $gettext('This pastebin is read-only.') : error }}
      </p>
      <oc-button
        v-if="isReadOnly"
        type="router-link"
        :to="viewRoute"
        appearance="filled"
        size="small"
        class="ext:mt-4"
      >
        {{ $gettext('View pastebin') }}
      </oc-button>
    </div>

    <template v-else>
      <AppHeader>
        <template #title>
          <router-link
            :to="{ name: 'pastebin-list' }"
            class="ext:no-underline ext:opacity-60 hover:ext:opacity-100"
            >{{ $gettext('Your Pastebins') }}</router-link
          >
          <span class="ext:mx-2 ext:opacity-40">/</span>
          <router-link
            :to="viewRoute"
            class="ext:no-underline ext:opacity-60 hover:ext:opacity-100"
            >{{ folderName }}</router-link
          >
          <span class="ext:mx-2 ext:opacity-40">/</span>
          {{ $gettext('Edit') }}
        </template>
        <template #actions>
          <oc-button type="router-link" :to="viewRoute" appearance="outline" size="small">
            <oc-icon name="close" size="small" class="ext:mr-1" />
            {{ $gettext('Cancel') }}
          </oc-button>
        </template>
      </AppHeader>

      <div class="ext:flex-1 ext:overflow-y-auto ext:p-5">
        <div class="ext:max-w-4xl ext:mx-auto">
          <div class="ext:flex ext:flex-col ext:gap-4">
            <PastebinEditor
              v-for="(file, index) in editableFiles"
              :key="file.clientId"
              :filename="file.filename"
              :content="file.content"
              :removable="editableFiles.length > 1"
              @update:filename="file.filename = $event"
              @update:content="updateFileContent(file, $event)"
              @remove="removeFile(index)"
            />
          </div>

          <div class="ext:flex ext:items-center ext:justify-between ext:mt-4">
            <oc-button appearance="raw" size="small" @click="addFile">
              <oc-icon name="add" size="small" class="ext:mr-1" />
              {{ $gettext('Add file') }}
            </oc-button>
            <oc-button appearance="filled" size="medium" :disabled="saving" @click="loadingService.addTask(() => save())">
              {{ saving ? $gettext('Saving…') : $gettext('Save Changes') }}
            </oc-button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Resource, SpaceResource, urlJoin } from '@opencloud-eu/web-client'
import {
  useClientService,
  useLoadingService,
  useMessages,
  useRouter,
  contextRouteNameKey
} from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import AppHeader from './components/AppHeader.vue'
import PastebinEditor from './components/PastebinEditor.vue'
import { parsePastebinName, DEFAULT_FILENAME, FILE_EXTENSION, loadRevisionFiles } from './utils'

interface EditableFile {
  clientId: string
  id?: string
  filename: string
  originalFilename?: string
  content: string
  dirty: boolean
  isNew: boolean
}

const {
  space,
  resource,
  isReadOnly = false
} = defineProps<{
  space: SpaceResource
  resource: Resource
  isReadOnly?: boolean
}>()

const clientService = useClientService()
const loadingService = useLoadingService()
const { showMessage, showErrorMessage } = useMessages()
const router = useRouter()
const { $gettext } = useGettext()

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const editableFiles = reactive<EditableFile[]>([])
const deletedFiles = reactive<string[]>([])
const revisionPath = ref('')

const folderName = computed(() => {
  const { title } = parsePastebinName(resource.name || '')
  return title || resource.name?.replace(`.${FILE_EXTENSION}`, '') || $gettext('Pastebin')
})

const viewRoute = computed(() => {
  const driveAliasAndItem = space.getDriveAliasAndItem(resource)
  return { name: 'pastebin-view', params: { driveAliasAndItem } }
})

const updateFileContent = (file: EditableFile, content: string) => {
  file.content = content
  file.dirty = true
}

const addFile = () => {
  editableFiles.push({ clientId: crypto.randomUUID(), filename: '', content: '', dirty: false, isNew: true })
}

const removeFile = (index: number) => {
  const file = editableFiles[index]
  if (!file.isNew && file.originalFilename) {
    deletedFiles.push(file.originalFilename)
  }
  editableFiles.splice(index, 1)
}

const save = async () => {
  saving.value = true
  try {
    const { webdav } = clientService

    // Delete removed files
    for (const filename of deletedFiles) {
      try {
        await webdav.deleteFile(space, { path: urlJoin(revisionPath.value, filename) })
      } catch {
        // file may already be gone
      }
    }

    // Write all current files
    for (const file of editableFiles) {
      const filename = file.filename.trim() || DEFAULT_FILENAME

      // If renamed, delete the old file first
      if (file.originalFilename && file.originalFilename !== filename) {
        try {
          await webdav.deleteFile(space, { path: urlJoin(revisionPath.value, file.originalFilename) })
        } catch {
          // old file may not exist
        }
      }

      await webdav.putFileContents(space, {
        path: urlJoin(revisionPath.value, filename),
        content: file.content
      })
    }

    showMessage({ title: $gettext('Pastebin updated') })

    const driveAliasAndItem = space.getDriveAliasAndItem(resource)
    await router.push({
      name: 'pastebin-view',
      params: { driveAliasAndItem },
      query: { fileId: resource.fileId, [contextRouteNameKey]: 'pastebin-list' }
    })
  } catch (err) {
    console.error('Failed to save:', err)
    showErrorMessage({
      title: $gettext('Failed to save'),
      errors: [err instanceof Error ? err : new Error(String(err))]
    })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    loading.value = true
    const { webdav } = clientService

    const { children } = await webdav.listFiles(space, { path: resource.path })
    const result = await loadRevisionFiles(webdav, space, resource.path, children)
    revisionPath.value = result.revisionPath || resource.path

    for (const child of result.files) {
      const fileContent = await (
        await webdav.getFileContents(space, {
          fileId: child.fileId,
          path: child.path
        })
      ).body

      editableFiles.push({
        clientId: crypto.randomUUID(),
        id: child.id,
        filename: child.name,
        originalFilename: child.name,
        content: fileContent,
        dirty: false,
        isNew: false
      })
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : $gettext('Failed to load pastebin')
  } finally {
    loading.value = false
  }
})
</script>
