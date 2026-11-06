<template>
  <div
    v-if="data"
    class="pdf-studio-signature-image-preview ext:relative ext:flex-1 ext:overflow-hidden"
  >
    <svg
      class="ext:absolute ext:inset-8 ext:size-[calc(100%-4rem)]"
      :viewBox="data.outline.viewBox"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="fileName"
    >
      <path :d="data.outline.toSVGPath()" fill="currentColor" />
    </svg>
    <oc-button
      v-oc-tooltip="$gettext('Clear')"
      class="pdf-studio-signature-image-clear ext:absolute ext:top-2 ext:right-2 ext:p-1.5"
      :aria-label="$gettext('Clear')"
      appearance="raw"
      @click="clear"
    >
      <oc-icon name="eraser" fill-type="line" size-class="ext:size-4" />
    </oc-button>
  </div>
  <oc-file-input
    v-else
    v-model="files"
    class="pdf-studio-signature-image ext:flex ext:flex-1 ext:flex-col ext:justify-center ext:px-8"
    :label="$gettext('Image of your signature')"
    :description-message="$gettext('A photo or scan of your signature on white paper works best.')"
    :error-message="error"
    file-types="image/*"
    preview-icon="image"
    @update:model-value="onSelect"
  />
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { SignatureData } from '../composables/usePdfSignature'

const { getFromImage } = defineProps<{
  getFromImage: (file: File) => Promise<SignatureData | null>
}>()

// In the parent, so the signature stays while another tab is shown.
const data = defineModel<SignatureData | null>('data', { default: null })
const fileName = defineModel<string>('fileName', { default: '' })

const { $gettext } = useGettext()

const files = shallowRef<FileList>()
const error = ref('')

// The image being read, another one may be chosen in the meantime.
let currentFile: File | undefined

function clear() {
  files.value = undefined
  currentFile = undefined
  data.value = null
  fileName.value = ''
}

function onSelect(selected: FileList | undefined) {
  useImage(selected?.[0])
}

/** An image from the device or the cloud. */
async function useImage(file: File | undefined) {
  currentFile = file
  data.value = null
  fileName.value = ''
  error.value = ''
  if (!file) {
    return
  }
  const found = await getFromImage(file)
  if (currentFile !== file) {
    return
  }
  if (!found) {
    error.value = $gettext('No signature could be found in this image.')
    return
  }
  data.value = found
  fileName.value = file.name
}

/** Takes an image from elsewhere, e.g. picked from the cloud. */
defineExpose({ useImage })
</script>
