<template>
  <oc-button
    v-oc-tooltip="label"
    :aria-label="label"
    :aria-expanded="isExpanded"
    class="ext:size-8 ext:shrink-0 ext:justify-center"
    appearance="raw"
    gap-size="none"
    @click="emit('toggle')"
  >
    <oc-icon
      :name="isExpanded ? 'arrow-down-s' : 'arrow-right-s'"
      fill-type="line"
      size-class="ext:size-4"
    />
  </oc-button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'

const { isExpanded = false } = defineProps<{
  isExpanded?: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const { $gettext } = useGettext()

const label = computed(() => (isExpanded ? $gettext('Collapse') : $gettext('Expand')))
</script>
