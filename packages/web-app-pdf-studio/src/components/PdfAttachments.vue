<template>
  <oc-list raw class="pdf-studio-attachments ext:flex ext:flex-col ext:gap-2">
    <li v-for="{ attachment, resource } in items" :key="attachment.key">
      <oc-button
        :title="attachment.description || undefined"
        class="pdf-studio-attachment ext:w-full ext:rounded-xl ext:bg-role-surface-container ext:p-3 ext:text-left ext:hover:bg-role-surface-container-high"
        :aria-label="$gettext('Download %{name}', { name: attachment.filename })"
        appearance="raw-inverse"
        color-role="surface"
        justify-content="left"
        gap-size="medium"
        no-hover
        @click="emit('open', attachment)"
      >
        <resource-icon :resource="resource" size-class="ext:size-8 ext:shrink-0" />
        <span class="ext:flex ext:min-w-0 ext:flex-1 ext:flex-col">
          <span
            class="ext:break-words ext:text-sm ext:font-semibold"
            dir="auto"
            v-text="attachment.filename"
          />
          <span
            class="ext:line-clamp-2 ext:text-xs ext:text-role-on-surface-variant"
            dir="auto"
            v-text="attachment.description || getFileType(resource)"
          />
        </span>
        <oc-icon
          name="download-2"
          fill-type="line"
          size-class="ext:size-4"
          class="ext:shrink-0 ext:text-role-on-surface-variant"
        />
      </oc-button>
    </li>
  </oc-list>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { extractExtensionFromFile, type Resource } from '@opencloud-eu/web-client'
import { ResourceIcon } from '@opencloud-eu/web-pkg'
import type { PdfAttachment } from '../composables/usePdfAttachments'

const { attachments } = defineProps<{ attachments: PdfAttachment[] }>()

const emit = defineEmits<{ open: [attachment: PdfAttachment] }>()

const { $gettext } = useGettext()

// For the file type icon.
const items = computed(() =>
  attachments.map((attachment) => {
    const name = attachment.filename
    const extension = extractExtensionFromFile({ name } as Resource)
    return { attachment, resource: { name, extension, type: 'file' } as Resource }
  })
)

function getFileType({ extension }: Resource) {
  return extension ? $gettext('%{type} file', { type: extension.toUpperCase() }) : $gettext('File')
}
</script>
