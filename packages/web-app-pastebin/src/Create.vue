<template>
  <div class="ext:flex ext:flex-col ext:h-full">
    <AppHeader>
      <template #title>
        <router-link
          :to="{ name: 'pastebin-list' }"
          class="ext:no-underline ext:opacity-60 hover:ext:opacity-100"
          >{{ $gettext('Your Pastebins') }}</router-link
        >
        <span class="ext:mx-2 ext:opacity-40">/</span>
        {{ $gettext('New') }}
      </template>
    </AppHeader>

    <div class="ext:flex-1 ext:overflow-y-auto ext:p-5">
      <div class="ext:max-w-4xl ext:mx-auto">
        <oc-text-input
          v-model="title"
          :label="$gettext('Title')"
          :fix-message-line="true"
          class="ext:mb-2"
        />

        <div class="ext:flex ext:flex-col ext:gap-4">
          <PastebinEditor
            v-for="(file, index) in files"
            :key="file.clientId"
            :filename="file.filename"
            :content="file.content"
            :removable="files.length > 1"
            @update:filename="file.filename = $event"
            @update:content="file.content = $event"
            @remove="files.splice(index, 1)"
          />
        </div>

        <oc-text-input
          v-if="passwordRequired"
          v-model="password"
          type="password"
          :label="$gettext('Link password')"
          :password-policy="passwordPolicy"
          :generate-password-method="generatePassword"
          :error-message="passwordError"
          :fix-message-line="true"
          :required-mark="true"
          class="ext:mt-4"
          @update:model-value="passwordError = ''"
          @password-challenge-completed="passwordValid = true"
          @password-challenge-failed="passwordValid = false"
        />

        <div class="ext:flex ext:items-center ext:justify-between ext:mt-4">
          <oc-button appearance="raw" size="small" @click="addFile">
            <oc-icon name="add" size="small" class="ext:mr-1" />
            {{ $gettext('Add file') }}
          </oc-button>
          <oc-button
            appearance="filled"
            size="medium"
            :disabled="saving || !hasContent || (passwordRequired && !passwordValid)"
            @click="loadingService.addTask(() => save())"
          >
            {{ saving ? $gettext('Creating…') : $gettext('Create Pastebin') }}
          </oc-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, unref } from 'vue'
import {
  useClientService,
  useLoadingService,
  useMessages,
  usePasswordPolicyService,
  useResourcesStore,
  useSpacesStore,
  useSharesStore,
  useLinkTypes,
  useRouter,
  contextRouteNameKey
} from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useClipboard } from '@vueuse/core'
import AppHeader from './components/AppHeader.vue'
import PastebinEditor from './components/PastebinEditor.vue'
import { urlJoin } from '@opencloud-eu/web-client'
import { SharingLinkType } from '@opencloud-eu/web-client/graph/generated'
import {
  slugify,
  ensurePastebinFolders,
  PASTEBIN_BASE_PATH,
  MANIFEST_FILENAME,
  REVISIONS_DIR,
  DEFAULT_FILENAME
} from './utils'

const { $gettext } = useGettext()

const title = ref('')
const createFile = () => ({ clientId: crypto.randomUUID(), filename: '', content: '' })
const files = reactive([createFile()])
const saving = ref(false)

const { showMessage, showErrorMessage } = useMessages()
const clientService = useClientService()
const spacesStore = useSpacesStore()
const resourcesStore = useResourcesStore()
const { addLink } = useSharesStore()
const { defaultLinkType, isPasswordEnforcedForLinkType } = useLinkTypes()
const loadingService = useLoadingService()
const { copy } = useClipboard({ legacy: true })
const passwordPolicyService = usePasswordPolicyService()
const router = useRouter()

const passwordRequired = computed(() => {
  const linkType = unref(defaultLinkType) || SharingLinkType.View
  return isPasswordEnforcedForLinkType(linkType)
})
const password = ref('')
const passwordError = ref('')
const passwordValid = ref(false)
const passwordPolicy = computed(() =>
  passwordPolicyService.getPolicy({ enforcePassword: passwordRequired.value })
)
const generatePassword = () => passwordPolicyService.generatePassword()

const hasContent = computed(() => files.some((f) => f.content.trim()))

const addFile = () => {
  files.push(createFile())
}

const save = async () => {
  if (!spacesStore.personalSpace) {
    showErrorMessage({
      title: $gettext('Cannot create pastebin'),
      errors: [new Error($gettext('No personal space available'))]
    })
    return
  }

  const nonEmptyFiles = files.filter((f) => f.content.trim())
  if (nonEmptyFiles.length === 0 || (passwordRequired.value && !passwordValid.value)) {
    return
  }

  saving.value = true

  try {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-')
    const { webdav } = clientService

    await ensurePastebinFolders(webdav, spacesStore.personalSpace)

    const slug = title.value.trim() ? `-${slugify(title.value)}` : ''
    const folderPath = urlJoin(PASTEBIN_BASE_PATH, `${timestamp}${slug}.ocpb`)

    try {
      await webdav.createFolder(spacesStore.personalSpace, { path: folderPath })
    } catch {
      // may already exist
    }

    // Write manifest
    const manifest = { title: title.value.trim() || `pastebin-${timestamp}` }
    await webdav.putFileContents(spacesStore.personalSpace, {
      path: urlJoin(folderPath, MANIFEST_FILENAME),
      content: JSON.stringify(manifest, null, 2)
    })

    // Create revisions/0/ and save files there
    const revisionPath = urlJoin(folderPath, REVISIONS_DIR)
    try {
      await webdav.createFolder(spacesStore.personalSpace, { path: revisionPath })
    } catch {
      // may already exist
    }
    const currentRevisionPath = urlJoin(revisionPath, '0')
    try {
      await webdav.createFolder(spacesStore.personalSpace, { path: currentRevisionPath })
    } catch {
      // may already exist
    }

    for (const file of nonEmptyFiles) {
      const filename = file.filename.trim() || DEFAULT_FILENAME
      await webdav.putFileContents(spacesStore.personalSpace, {
        path: urlJoin(currentRevisionPath, filename),
        content: file.content
      })
    }

    // Create public link
    const folderResource = await webdav.getFileInfo(spacesStore.personalSpace, { path: folderPath })
    resourcesStore.initResourceList({ currentFolder: folderResource, resources: [] })

    try {
      const linkType = unref(defaultLinkType) || SharingLinkType.View

      const linkShare = await addLink({
        clientService,
        space: spacesStore.personalSpace,
        resource: folderResource,
        options: {
          '@libre.graph.quickLink': false,
          displayName: title.value.trim() || `pastebin-${timestamp}`,
          type: linkType,
          ...(passwordRequired.value && password.value && { password: password.value })
        }
      })

      const clipboardText = linkShare.hasPassword
        ? `${linkShare.webUrl}\nPassword: ${password.value}`
        : linkShare.webUrl
      await copy(clipboardText)

      showMessage({
        title: $gettext('Pastebin created and link copied to clipboard!'),
        desc: linkShare.webUrl
      })
    } catch (linkError) {
      console.error('Failed to create public link:', linkError)
      showMessage({ title: $gettext('Pastebin created successfully') })
      showErrorMessage({
        title: $gettext('Failed to create public link'),
        errors: [linkError instanceof Error ? linkError : new Error(String(linkError))]
      })
    }

    const driveAliasAndItem = spacesStore.personalSpace.getDriveAliasAndItem(folderResource)
    await router.push({
      name: 'pastebin-view',
      params: { driveAliasAndItem },
      query: { fileId: folderResource.fileId, [contextRouteNameKey]: 'pastebin-list' }
    })
  } catch (error) {
    console.error('Failed to create pastebin:', error)
    showErrorMessage({
      title: $gettext('Failed to create pastebin'),
      errors: [error instanceof Error ? error : new Error(String(error))]
    })
  } finally {
    saving.value = false
  }
}
</script>
