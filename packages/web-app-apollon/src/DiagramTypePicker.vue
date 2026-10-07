<template>
  <div class="flex size-full items-center justify-center overflow-auto p-4">
    <div class="max-w-2xl">
      <h2 class="mb-2 text-lg font-semibold" v-text="$gettext('New diagram')" />
      <p class="mb-4" v-text="$gettext('Choose a diagram type to start drawing.')" />
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        <oc-button
          v-for="[type, label] in types"
          :key="type"
          appearance="outline"
          :data-diagram-type="type"
          @click="emit('select', type)"
        >
          <span v-text="label" />
        </oc-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { UMLDiagramType } from '@tumaet/apollon'
import { diagramTypeEntries } from './diagramTypes'

const emit = defineEmits<{
  (e: 'select', type: UMLDiagramType): void
}>()

const { $gettext } = useGettext()

const types = computed(() => diagramTypeEntries($gettext))
</script>
