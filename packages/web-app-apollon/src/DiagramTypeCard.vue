<template>
  <oc-card
    class="ext:relative ext:flex ext:flex-col ext:overflow-hidden ext:border ext:bg-role-surface-container ext:hover:bg-role-surface-container-highest"
    body-class="ext:flex ext:flex-col"
  >
    <template #header>
      <inline-svg :src="entry.image" class="ext:h-20" aria-hidden="true" unique-ids />
    </template>
    <h4 class="ext:my-0 ext:text-base">
      <button
        type="button"
        class="ext:cursor-pointer ext:text-left ext:font-semibold ext:after:absolute ext:after:inset-0"
        :aria-describedby="descriptionId"
        :data-diagram-type="entry.type"
        @click="emit('select', entry.type)"
        v-text="entry.name"
      />
    </h4>
    <span
      :id="descriptionId"
      class="ext:mt-1 ext:text-sm ext:text-role-on-surface-variant"
      v-text="entry.description"
    />
  </oc-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InlineSvg from 'vue-inline-svg'
import type { UMLDiagramType } from '@tumaet/apollon'
import type { DiagramTypeEntry } from './diagramTypes'

const { entry } = defineProps<{
  entry: DiagramTypeEntry
}>()

const emit = defineEmits<{
  (e: 'select', type: UMLDiagramType): void
}>()

const descriptionId = computed(() => `apollon-diagram-type-${entry.type}-description`)
</script>
