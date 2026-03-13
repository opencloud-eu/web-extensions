<template>
  <div class="flex items-center gap-2 w-full">
    <oc-icon name="calculator" fill-type="line" />
    <span class="font-medium flex-1">{{ formattedResult }}</span>
    <oc-button
      v-if="!isError"
      v-oc-tooltip="$gettext('Copy result to clipboard')"
      :aria-label="$gettext('Copy result to clipboard')"
      appearance="raw"
      class="p-1"
      @click.stop.prevent="copyResult"
    >
      <oc-icon :name="copied ? 'checkbox-circle' : 'file-copy'" fill-type="line" />
    </oc-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMessages } from '@opencloud-eu/web-pkg'
import { useClipboard } from '@vueuse/core'
import { useGettext } from 'vue3-gettext'
import { SearchResultValue } from '@opencloud-eu/web-pkg'

const props = defineProps<{
  searchResult: SearchResultValue
}>()

const { $gettext, current: currentLocale } = useGettext()
const { showMessage } = useMessages()
const { copy, copied } = useClipboard({ legacy: true, copiedDuring: 550 })

const errorMessages: Record<string, () => string> = {
  'division-by-zero': () => $gettext('Cannot divide by zero')
}

const isError = computed(() => String(props.searchResult.data.name) in errorMessages)

const formattedResult = computed(() => {
  const name = String(props.searchResult.data.name)
  if (name in errorMessages) {
    return errorMessages[name]()
  }
  const raw = Number(name)
  if (isNaN(raw)) {
    return name
  }
  return new Intl.NumberFormat(currentLocale).format(raw)
})

const copyResult = () => {
  copy(formattedResult.value)
  showMessage({
    title: $gettext('Result copied to clipboard.')
  })
}
</script>
