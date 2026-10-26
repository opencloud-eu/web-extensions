<template>
  <div class="ext:h-full ext:overflow-auto ext:p-4 ext:md:px-8">
    <div class="ext:mx-auto ext:max-w-6xl">
      <div
        class="ext:mt-2 ext:mb-4 ext:flex ext:flex-wrap ext:items-center ext:justify-between ext:gap-4"
      >
        <div>
          <h2 class="ext:my-0 ext:text-2xl" v-text="$gettext('New diagram')" />
          <p
            class="ext:mt-1 ext:mb-0 ext:text-sm ext:text-role-on-surface-variant"
            v-text="$gettext('Choose a diagram type to start drawing.')"
          />
        </div>
        <oc-search-bar
          v-model="filterTerm"
          is-filter
          class="ext:w-full ext:sm:w-auto"
          :label="$gettext('Filter diagram types')"
          :placeholder="$gettext('Filter diagram types')"
          button-hidden
          :is-rounded="false"
        />
      </div>
      <span class="ext:sr-only" role="status" v-text="resultCountText" />
      <no-content-message v-if="!filteredGroups.length" icon="flow-chart">
        <template #message>
          <span v-text="$gettext('No diagram types found')" />
        </template>
        <template #callToAction>
          <span v-text="$gettext('Try refining the search term to get results')" />
        </template>
      </no-content-message>
      <section v-for="group in filteredGroups" :key="group.id" class="ext:mb-6">
        <h3
          class="ext:mt-0 ext:mb-2 ext:text-base"
          v-text="`${group.title} (${group.types.length})`"
        />
        <div class="ext:grid ext:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] ext:gap-4">
          <DiagramTypeCard
            v-for="entry in group.types"
            :key="entry.type"
            :entry="entry"
            @select="emit('select', $event)"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { UMLDiagramType } from '@tumaet/apollon'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import DiagramTypeCard from './DiagramTypeCard.vue'
import { diagramTypeGroups, filterDiagramTypeGroups } from './diagramTypes'

const emit = defineEmits<{
  (e: 'select', type: UMLDiagramType): void
}>()

const { $gettext, $ngettext } = useGettext()

const filterTerm = ref('')

const groups = computed(() => diagramTypeGroups($gettext))

const filteredGroups = computed(() => filterDiagramTypeGroups(unref(groups), unref(filterTerm)))

const resultCountText = computed(() => {
  const count = unref(filteredGroups).reduce((sum, group) => sum + group.types.length, 0)
  return $ngettext('%{count} diagram type', '%{count} diagram types', count, {
    count: count.toString()
  })
})
</script>
