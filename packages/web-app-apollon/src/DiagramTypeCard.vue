<template>
  <oc-card
    tag="button"
    type="button"
    class="ext:flex ext:cursor-pointer ext:flex-col ext:overflow-hidden ext:border ext:bg-role-surface-container ext:text-left ext:hover:bg-role-surface-container-highest"
    body-class="ext:flex ext:flex-col"
    :aria-label="$gettext('Create %{name}', { name: entry.name })"
    :data-diagram-type="entry.type"
  >
    <template #header>
      <inline-svg :src="entry.image" class="ext:h-20" aria-hidden="true" unique-ids />
    </template>
    <span class="ext:font-semibold" v-text="entry.name" />
    <span
      class="ext:mt-1 ext:text-sm ext:text-role-on-surface-variant"
      v-text="entry.description"
    />
  </oc-card>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'
import InlineSvg from 'vue-inline-svg'
import type { DiagramTypeEntry } from './diagramTypes'

defineProps<{
  entry: DiagramTypeEntry
}>()

const { $gettext } = useGettext()
</script>
