<template>
  <div class="pdf-studio-document-properties ext:flex ext:flex-col ext:gap-3">
    <oc-section
      v-for="section in sections"
      :key="section.id"
      :title="section.title"
      :icon="section.icon"
      title-tag="h3"
    >
      <dl
        class="ext:m-0 ext:grid ext:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] ext:gap-x-4 ext:gap-y-2 ext:text-sm"
      >
        <template v-for="row in section.rows" :key="row.label">
          <dt class="ext:break-words ext:text-role-on-surface-variant" v-text="row.label" />
          <dd
            class="ext:m-0 ext:whitespace-pre-line ext:break-words"
            dir="auto"
            v-text="row.value || '–'"
          />
        </template>
      </dl>
    </oc-section>
  </div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { formatDateFromJSDate, formatFileSize, type Modal } from '@opencloud-eu/web-pkg'
import type { DocumentProperties } from '../helpers/documentProperties'

const {
  properties,
  fileName,
  fileSize = undefined
} = defineProps<{
  modal: Modal
  properties: DocumentProperties
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
  const size = properties.pageSize
  if (!size) {
    return ''
  }
  const { format } = new Intl.NumberFormat(language.current.replace('_', '-'))
  const orientation = size.isPortrait ? $gettext('portrait') : $gettext('landscape')
  const details = size.name ? `${size.name}, ${orientation}` : orientation
  return `${format(size.width)} × ${format(size.height)} ${size.unit} (${details})`
})

// The fields of the PDF.js viewer's document properties, in its groups. The labels have the
// same width in all of them, so the values line up.
const sections = computed(() => [
  {
    id: 'file',
    title: $gettext('File'),
    icon: 'file',
    rows: [
      { label: $gettext('File name'), value: fileName },
      {
        label: $gettext('File size'),
        value: fileSize === undefined ? '' : formatFileSize(fileSize, language.current)
      }
    ]
  },
  {
    id: 'description',
    title: $gettext('Description'),
    icon: 'information',
    rows: [
      { label: $gettext('Title'), value: properties.title },
      { label: $gettext('Author'), value: properties.author },
      { label: $gettext('Subject'), value: properties.subject },
      { label: $gettext('Keywords'), value: properties.keywords },
      { label: $gettext('Creation date'), value: formatDate(properties.creationDate) },
      { label: $gettext('Modification date'), value: formatDate(properties.modificationDate) },
      { label: $gettext('Application'), value: properties.creator }
    ]
  },
  {
    id: 'pdf',
    title: $gettext('PDF'),
    icon: 'file-pdf-2',
    rows: [
      { label: $gettext('PDF producer'), value: properties.producer },
      { label: $gettext('PDF version'), value: properties.version },
      { label: $gettext('Page count'), value: String(properties.pageCount) },
      { label: $gettext('Page size'), value: unref(pageSize) },
      {
        label: $gettext('Fast web view'),
        value: properties.isLinearized ? $gettext('Yes') : $gettext('No')
      }
    ]
  }
])
</script>
