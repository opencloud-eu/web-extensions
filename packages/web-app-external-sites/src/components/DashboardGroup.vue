<template>
  <h2 v-if="group.name" class="ext:flex ext:items-center ext:mb-4">
    {{ group.name }}
  </h2>
  <div class="ext:mb-6">
    <oc-list
      class="ext:grid ext:gap-4 ext:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]"
    >
      <dashboard-link
        v-for="site in sortedSites"
        :key="site.name"
        :site="site"
        :dashboard-path="dashboardPath"
      />
    </oc-list>
  </div>
</template>

<script setup lang="ts">
import DashboardLink from './DashboardLink.vue'
import { ExternalSiteGroup, ExternalSite } from '../types'
import { computed } from 'vue'

const props = defineProps<{
  group: ExternalSiteGroup
  dashboardPath: string
}>()

const sortedSites = computed((): ExternalSite[] => {
  const sortedSites = [...props.group.sites]
  return sortedSites.sort((a, b) => a.priority - b.priority) as ExternalSite[]
})
</script>
