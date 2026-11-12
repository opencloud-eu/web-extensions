<template>
  <oc-loader v-if="!properties" :aria-label="$gettext('Loading document properties')" />
  <div v-else class="pdf-studio-document-properties ext:flex ext:flex-col ext:gap-4 ext:p-2">
    <section
      v-for="section in sections"
      :key="section.id"
      class="ext:rounded-xl ext:bg-role-surface-container ext:px-4 ext:py-3"
    >
      <h3
        class="ext:mt-0 ext:mb-2 ext:flex ext:items-center ext:gap-2 ext:text-sm ext:font-semibold"
      >
        <oc-icon :name="section.icon" fill-type="line" size-class="ext:size-4" />
        <span v-text="section.title" />
      </h3>
      <oc-definition-list
        class="ext:[&_dd]:break-words ext:[&_dd]:whitespace-pre-line ext:[&_dd]:[unicode-bidi:plaintext]"
        :items="section.items"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { formatDateFromJSDate, formatFileSize } from '@opencloud-eu/web-pkg'
import type { DocumentProperties } from '../helpers/documentProperties'

const {
  properties = undefined,
  fileName,
  fileSize = undefined
} = defineProps<{
  /** Not until the document is loaded. */
  properties?: DocumentProperties
  fileName: string
  fileSize?: number
}>()

const language = useGettext()
const { $gettext } = language

function formatDate(date: Date | undefined) {
  return date ? formatDateFromJSDate(date, language.current) : ''
}

// The unit follows the browser locale like in the PDF.js viewer, the numbers the language.
const pageSize = computed(() => {
  const size = properties?.pageSize
  if (!size) {
    return ''
  }
  const { format } = new Intl.NumberFormat(language.current.replace('_', '-'))
  const orientation = size.isPortrait ? $gettext('portrait') : $gettext('landscape')
  const details = size.name ? `${size.name}, ${orientation}` : orientation
  return `${format(size.width)} × ${format(size.height)} ${size.unit} (${details})`
})

function item(term: string, definition: string | undefined) {
  return { term, definition: definition || '–' }
}

// The fields of the PDF.js viewer's document properties, in its groups.
const sections = computed(() => {
  if (!properties) {
    return []
  }
  return [
    {
      id: 'file',
      title: $gettext('File'),
      icon: 'file',
      items: [
        item($gettext('File name'), fileName),
        item(
          $gettext('File size'),
          fileSize === undefined ? '' : formatFileSize(fileSize, language.current)
        )
      ]
    },
    {
      id: 'description',
      title: $gettext('Description'),
      icon: 'information',
      items: [
        item($gettext('Title'), properties.title),
        item($gettext('Author'), properties.author),
        item($gettext('Subject'), properties.subject),
        item($gettext('Keywords'), properties.keywords),
        item($gettext('Creation date'), formatDate(properties.creationDate)),
        item($gettext('Modification date'), formatDate(properties.modificationDate)),
        item($gettext('Application'), properties.creator)
      ]
    },
    {
      id: 'pdf',
      title: $gettext('PDF'),
      icon: 'file-pdf-2',
      items: [
        item($gettext('PDF producer'), properties.producer),
        item($gettext('PDF version'), properties.version),
        item($gettext('Page count'), String(properties.pageCount)),
        item($gettext('Page size'), unref(pageSize)),
        item($gettext('Fast web view'), properties.isLinearized ? $gettext('Yes') : $gettext('No'))
      ]
    }
  ]
})
</script>
