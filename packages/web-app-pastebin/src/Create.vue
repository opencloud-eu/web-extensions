<template>
  <div class="create-pastebin">
    <h1>Create Pastebin</h1>
    <oc-textarea
      v-model="currentContent"
      class="pastebin-textarea"
      placeholder="Enter your content here..."
    />

    <div class="button-container">
      <oc-button appearance="filled" size="medium" @click.stop.prevent="save()">
        Save Pastebin
      </oc-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, unref } from 'vue'
import {
  useClientService,
  useMessages,
  useSpacesStore,
  useSharesStore
} from '@opencloud-eu/web-pkg'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { useLinkTypes } from '@opencloud-eu/web-pkg'
import { useClipboard, useRouter } from '@opencloud-eu/web-pkg'

const currentContent = ref<string>('')
const { showMessage, showErrorMessage } = useMessages()
const clientService = useClientService()
const spacesStore = useSpacesStore()
const { addLink } = useSharesStore()
const { defaultLinkType } = useLinkTypes()
const { copyToClipboard } = useClipboard()
const router = useRouter()

const save = async () => {
  if (!spacesStore.personalSpace) {
    showErrorMessage({
      title: 'No personal space available',
      errors: ['Cannot create file without access to personal space']
    })
    return
  }

  if (!currentContent.value.trim()) {
    showErrorMessage({
      title: 'Empty content',
      errors: ['Please enter some content before saving']
    })
    return
  }

  try {
    // Generate timestamp for both folder and file
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-')

    // Create folder structure step by step: .space -> pastebin -> exact-timestamp
    const webdav = clientService.webdav as WebDAV

    // Create .space folder first
    try {
      await webdav.createFolder(spacesStore.personalSpace, { path: '/.space' })
    } catch (error) {
      // Folder may already exist, ignore error
      console.log('.space folder creation (may already exist):', error)
    }

    // Create pastebin folder
    try {
      await webdav.createFolder(spacesStore.personalSpace, { path: '/.space/pastebin' })
    } catch (error) {
      // Folder may already exist, ignore error
      console.log('pastebin folder creation (may already exist):', error)
    }

    // Create timestamp folder
    const folderPath = `/.space/pastebin/${timestamp}`
    try {
      await webdav.createFolder(spacesStore.personalSpace, { path: folderPath })
    } catch (error) {
      // Folder may already exist, ignore error
      console.log('timestamp folder creation (may already exist):', error)
    }

    // Generate filename and full file path
    const fileName = `pastebin-${timestamp}.txt`
    const filePath = `${folderPath}/${fileName}`

    const resource = await (clientService.webdav as WebDAV).putFileContents(
      spacesStore.personalSpace,
      {
        path: filePath,
        content: currentContent.value
      }
    )

    // Get the folder resource to create a public link for it
    const folderResource = await (clientService.webdav as WebDAV).getFileInfo(
      spacesStore.personalSpace,
      { path: folderPath }
    )

    // Create a public link for the folder with password protection
    try {
      const linkShare = await addLink({
        clientService,
        space: spacesStore.personalSpace,
        resource: folderResource,
        options: {
          '@libre.graph.quickLink': false,
          displayName: `Pastebin Link ${timestamp}`,
          type: unref(defaultLinkType),
          password: 'Foobar!64'
        }
      })

      // Copy link and password to clipboard
      const clipboardText = `${linkShare.webUrl}\nPassword: Foobar!64`
      await copyToClipboard(clipboardText)

      showMessage({
        title: `Pastebin "${resource.name}" was created and link copied to clipboard!`,
        desc: `Public link: ${linkShare.webUrl} (Password: Foobar!64)`
      })
    } catch (linkError) {
      console.error('Failed to create public link:', linkError)
      showMessage({
        title: `Pastebin "${resource.name}" was created successfully`
      })
      showErrorMessage({
        title: 'Failed to create public link',
        errors: [linkError]
      })
    }

    // Clear the content after successful save
    currentContent.value = ''

    // Redirect to the show route with the folder path
    const driveAliasAndItem = spacesStore.personalSpace.getDriveAliasAndItem({ path: folderPath })
    console.log('Redirecting to show route with:', driveAliasAndItem)
    await router.push(`/pastebin/show/${driveAliasAndItem}`)
    console.log('Pastebin file created:', resource)
    return resource
  } catch (error) {
    console.error('Failed to create pastebin file:', error)
    showErrorMessage({
      title: 'Failed to create file',
      errors: [error]
    })
    throw error
  }
}
</script>

<style scoped>
.create-pastebin {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 1rem;
}

.pastebin-textarea {
  width: 80%;
  height: 60%;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  resize: both;
  outline: none;
}

.pastebin-textarea:focus {
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

h1 {
  margin-bottom: 1rem;
  color: #333;
}

.button-container {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-start;
}
</style>
