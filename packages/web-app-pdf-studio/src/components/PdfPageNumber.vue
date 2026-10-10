<template>
  <input
    ref="input"
    :type="pageLabels ? 'text' : 'number'"
    :value="currentPage"
    :aria-label="$gettext('Page number')"
    class="pdf-studio-page-number ext:h-8 ext:rounded ext:border ext:border-role-outline-variant ext:bg-role-surface ext:text-center ext:text-sm ext:[appearance:textfield] ext:[&::-webkit-inner-spin-button]:appearance-none ext:[&::-webkit-outer-spin-button]:appearance-none"
    :class="pageLabels ? 'ext:w-16' : 'ext:w-11'"
    min="1"
    :max="pagesCount"
    @change="onChange"
  />
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
// so the input's type is bound before its value: a number input would drop a label.
const currentPage = computed(() => pageLabels?.[pageNumber - 1] ?? String(pageNumber))
const pagesText = computed(() => {
  const count = String(pagesCount)
  return pageLabels
    ? $gettext('(%{page} of %{count})', { page: String(pageNumber), count })
    : $gettext('of %{count}', { count })
})

// A label first, otherwise the number, like in the PDF.js viewer.
function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  const labelIndex = pageLabels?.indexOf(input.value) ?? -1
  const page = labelIndex >= 0 ? labelIndex + 1 : Number(input.value)
  // Shows the current page again, unless going to another one replaces it.
  input.value = unref(currentPage)
  if (Number.isInteger(page) && page >= 1 && page <= pagesCount) {
    emit('goToPage', page)
  }
}

const input = useTemplateRef<HTMLInputElement>('input')

function select() {
  unref(input)?.select()
}

defineExpose({ select })
</script>
