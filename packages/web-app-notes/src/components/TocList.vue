<template>
  <ul class="pl-0">
    <li
      v-for="node in nodes"
      :key="node.resource.isFolder ? `folder-${node.resource.id}` : `file-${node.resource.id}`"
    >
      <div class="flex items-center gap-1 py-1">
        <template v-if="node.resource.isFolder">
          <OcButton appearance="raw" class="p-1">
            <oc-icon name="arrow-down-s" fill-type="line" class="text-neutral-500" />
            <span class="font-medium">{{ node.resource.name }}</span>
          </OcButton>
        </template>
        <template v-else>
          <div class="w-100 flex justify-between">
            <OcButton
              appearance="raw"
              class="p-1"
              :class="{ 'font-semibold': node.resource.id === activeFileId }"
              @click="$emit('open', node)"
            >
              <OcIcon name="article" fill-type="line" class="text-neutral-500" />
              {{ extractNameWithoutExtension(node.resource) }}
            </OcButton>
            <div class="flex nowrap">
              <OcButton
                v-if="node.resource.id === activeFileId"
                appearance="raw"
                class="p-1"
                :disabled="!activeFileDirty"
                @click="$emit('save', node)"
              >
                <OcIcon name="save" fill-type="line" />
              </OcButton>
            </div>
          </div>
        </template>
      </div>
      <div v-if="node.children?.length" class="ml-4">
        <TocList
          :nodes="node.children"
          :active-file-id="activeFileId"
          :active-file-dirty="activeFileDirty"
          @open="$emit('open', $event)"
          @save="$emit('save', $event)"
        />
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { TocNode } from '../types'
import { extractNameWithoutExtension } from '@opencloud-eu/web-client'

const {
  nodes,
  activeFileId = undefined,
  activeFileDirty = false
} = defineProps<{
  nodes: TocNode[]
  activeFileId?: string
  activeFileDirty?: boolean
}>()

defineEmits<{
  (e: 'open', node: TocNode): void
  (e: 'save', node: TocNode): void
}>()
</script>
