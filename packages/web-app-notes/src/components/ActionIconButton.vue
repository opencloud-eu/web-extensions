<template>
  <OcButton
    v-oc-tooltip="action.label(actionOptions)"
    appearance="raw"
    :aria-label="action.label(actionOptions)"
    :disabled="action.isDisabled?.(actionOptions) || false"
    @click="() => action.handler(actionOptions)"
  >
    <OcIcon
      :name="typeof action.icon === 'function' ? action.icon(actionOptions) : action.icon"
      fill-type="line"
    />
  </OcButton>
</template>

<script setup lang="ts">
import { Resource } from '@opencloud-eu/web-client'
import { useNotebookStore } from '../composables'
import { computed } from 'vue'
import { Action } from '@opencloud-eu/web-pkg'

const { action, resource } = defineProps<{
  action: Action
  resource: Resource
}>()
const notebookStore = useNotebookStore()

const actionOptions = computed(() => {
  return {
    space: notebookStore.space,
    resources: [resource]
  }
})
</script>
