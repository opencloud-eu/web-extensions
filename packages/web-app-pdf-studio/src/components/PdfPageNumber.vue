<template>
  <oc-text-input
    id="pdf-studio-page-number"
    ref="input"
    :type="pageLabels ? 'text' : 'number'"
    :model-value="currentPage"
    :label="$gettext('Page number')"
    class="pdf-studio-page-number ext:[&_input]:h-8! ext:[&_input]:text-center ext:[&_input]:text-sm ext:[&_input]:[appearance:textfield] ext:[&_input::-webkit-inner-spin-button]:appearance-none ext:[&_input::-webkit-outer-spin-button]:appearance-none"
    :class="pageLabels ? 'ext:w-16' : 'ext:w-11'"
    min="1"
    :max="pagesCount"
    @change="onChange"
  >
    <template #label>
      <label class="ext:sr-only" for="pdf-studio-page-number" v-text="$gettext('Page number')" />
    </template>
  </oc-text-input>
  <span
    class="pdf-studio-pages-count ext:whitespace-nowrap ext:px-1 ext:text-sm ext:text-role-on-surface-variant"
    v-text="pagesText"
  />
</template>

<script setup lang="ts">
import { computed, unref, useTemplateRef } from 'vue'
import { useGettext } from 'vue3-gettext'

const {
  pageNumber,
  pagesCount,
  pageLabels = undefined
} = defineProps<{
  pageNumber: number
  pagesCount: number
  /** E.g. "iii" for the third page, see usePdfPageLabels. */
  pageLabels?: string[]
}>()

const emit = defineEmits<{ goToPage: [pageNumber: number] }>()

const { $gettext } = useGettext()

// With page labels like in the PDF.js viewer: "iii (3 of 214)". They come after the document,
// and a number input would drop a label, so the type has to be set before the value, which
// OcTextInput does.
const currentPage = computed(() => pageLabels?.[pageNumber - 1] ?? String(pageNumber))
const pagesText = computed(() => {
  const count = String(pagesCount)
  return pageLabels
    ? $gettext('(%{page} of %{count})', { page: String(pageNumber), count })
    : $gettext('of %{count}', { count })
})

const input = useTemplateRef<{ $el: HTMLElement }>('input')

function getInputElement() {
  return unref(input)?.$el.querySelector('input')
}

// A label first, otherwise the number, like in the PDF.js viewer.
function onChange(value: string) {
  const labelIndex = pageLabels?.indexOf(value) ?? -1
  const page = labelIndex >= 0 ? labelIndex + 1 : Number(value)
  // Shows the current page again, unless going to another one replaces it. The model stays
  // the same, so the input doesn't follow it by itself.
  const element = getInputElement()
  if (element) {
    element.value = unref(currentPage)
  }
  if (Number.isInteger(page) && page >= 1 && page <= pagesCount) {
    emit('goToPage', page)
  }
}

function select() {
  getInputElement()?.select()
}

defineExpose({ select })
</script>
