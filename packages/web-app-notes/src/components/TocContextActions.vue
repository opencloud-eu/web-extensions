<template>
  <div>
    <OcButton
      :id="`toc-contextmenu-trigger-${extractDomSelector(node.resource.id)}`"
      appearance="raw"
      class="ext:py-1"
    >
      <OcIcon name="more-2" />
    </OcButton>
    <OcDrop
      :drop-id="`toc-contextmenu-${extractDomSelector(node.resource.id)}`"
      mode="click"
      padding-size="small"
      :toggle="`#toc-contextmenu-trigger-${extractDomSelector(node.resource.id)}`"
      close-on-click
      :title="node.resource.name"
      @click.stop.prevent
    >
      <ContextActionMenu :menu-sections="menuSections" :action-options="actionOptions" />
    </OcDrop>
  </div>
</template>

<script setup lang="ts">
import { ContextActionMenu, type MenuSection } from '@opencloud-eu/web-pkg'
import { TocNode } from '../types'
import { extractDomSelector } from '@opencloud-eu/web-client'
import { useNotebookStore } from '../composables'
import { computed } from 'vue'

const { node, menuSections } = defineProps<{
  node: TocNode
  menuSections: MenuSection[]
}>()
const notebookStore = useNotebookStore()

const actionOptions = computed(() => {
  return {
    space: notebookStore.space,
    resources: [node.resource]
  }
})
</script>
