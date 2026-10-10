<template>
  <oc-bubble-menu
    class="pdf-studio-find-bar ext:gap-1 ext:text-sm"
    @keydown.esc.prevent="emit('close')"
    @keydown.stop
  >
    <div class="ext:relative ext:w-52 ext:min-w-28 ext:shrink">
      <oc-search-bar
        ref="searchBar"
        v-model="query"
        class="pdf-studio-find-input ext:[&_input]:pr-16 ext:[&_.oc-search-button-wrapper]:hidden!"
        :label="$gettext('Find in document')"
        :placeholder="$gettext('Find in document…')"
        icon=""
        small
        button-hidden
        @keydown.enter.prevent="search('again', $event.shiftKey)"
      />
      <span
        v-if="query"
        class="pdf-studio-find-count ext:pointer-events-none ext:absolute ext:top-1/2 ext:right-3 ext:-translate-y-1/2 ext:text-xs ext:tabular-nums ext:text-role-on-surface-variant"
        aria-hidden="true"
        v-text="countText"
      />
      <span class="pdf-studio-find-result ext:sr-only" role="status" v-text="resultText" />
    </div>
    <pdf-toolbar-button
      :label="$gettext('Previous match')"
      icon="arrow-up-s"
      :disabled="!query"
      class="pdf-studio-find-previous"
      @click="search('again', true)"
    />
    <pdf-toolbar-button
      :label="$gettext('Next match')"
      icon="arrow-down-s"
      :disabled="!query"
      class="pdf-studio-find-next"
      @click="search('again')"
    />
    <pdf-toolbar-button
      id="pdf-studio-find-options-toggle"
      :label="$gettext('Search options')"
      icon="settings-3"
      class="pdf-studio-find-options"
    />
    <oc-drop
      drop-id="pdf-studio-find-options"
      toggle="#pdf-studio-find-options-toggle"
      :title="$gettext('Search options')"
      mode="click"
      padding-size="medium"
      :close-on-click="false"
      :is-menu="false"
      class="ext:w-auto"
    >
      <div class="ext:flex ext:flex-col ext:gap-2 ext:text-sm">
        <oc-checkbox
          :model-value="options.highlightAll"
          class="pdf-studio-find-highlight-all"
          :label="$gettext('Highlight all')"
          @update:model-value="setOption('highlightAll', $event, 'highlightallchange')"
        />
        <oc-checkbox
          :model-value="options.caseSensitive"
          class="pdf-studio-find-match-case"
          :label="$gettext('Match case')"
          @update:model-value="setOption('caseSensitive', $event, 'casesensitivitychange')"
        />
        <oc-checkbox
          :model-value="options.matchDiacritics"
          class="pdf-studio-find-match-diacritics"
          :label="$gettext('Match diacritics')"
          @update:model-value="setOption('matchDiacritics', $event, 'diacriticmatchingchange')"
        />
        <oc-checkbox
          :model-value="options.entireWord"
          class="pdf-studio-find-whole-words"
          :label="$gettext('Whole words')"
          @update:model-value="setOption('entireWord', $event, 'entirewordchange')"
        />
      </div>
    </oc-drop>
    <pdf-toolbar-button
      :label="$gettext('Close')"
      icon="close"
      class="pdf-studio-find-close"
      @click="emit('close')"
    />
  </oc-bubble-menu>
</template>

<script setup lang="ts">
import { computed, onMounted, unref, useTemplateRef, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { FindOptions, FindResult, FindType } from '../composables/usePdfFindBar'
import PdfToolbarButton from './PdfToolbarButton.vue'

const { findResult } = defineProps<{ findResult: FindResult }>()

const emit = defineEmits<{
  find: [query: string, options: FindOptions, params: { type: FindType; findPrevious: boolean }]
  close: []
}>()

const { $gettext, $ngettext } = useGettext()

const searchBar = useTemplateRef<{ $el: HTMLElement }>('searchBar')
// Kept by the parent while the find bar is closed, like in the PDF.js viewer.
const query = defineModel<string>('query', { default: '' })
const options = defineModel<FindOptions>('options', { required: true })

const resultText = computed(() => {
  if (!unref(query)) {
    return ''
  }
  if (findResult.notFound) {
    return $gettext('Phrase not found')
  }
  if (!findResult.total) {
    return ''
  }
  return $ngettext(
    '%{current} of %{total} match',
    '%{current} of %{total} matches',
    findResult.total,
    { current: String(findResult.current), total: String(findResult.total) }
  )
})

// Short like in browsers, the full sentence is for screen readers.
const countText = computed(() => {
  if (findResult.notFound) {
    return '0/0'
  }
  return findResult.total ? `${findResult.current}/${findResult.total}` : ''
})

function search(type: FindType, findPrevious = false) {
  emit('find', unref(query), { ...unref(options) }, { type, findPrevious })
}

function setOption(name: keyof FindOptions, value: boolean, type: FindType) {
  const findOptions = { ...unref(options), [name]: value }
  options.value = findOptions
  // Not search(), the model follows the parent only with the next render.
  emit('find', unref(query), findOptions, { type, findPrevious: false })
}

// Searches while typing, PDF.js debounces it.
watch(query, () => search(''))

function focus() {
  const input = unref(searchBar)?.$el.querySelector('input')
  input?.focus()
  input?.select()
}

onMounted(() => {
  focus()
  // The previous search again.
  if (unref(query)) {
    search('')
  }
})

defineExpose({ focus })
</script>
