<template>
  <main
    id="external-sites-dashboard"
    class="ext:pt-4 ext:pb-6 ext:flex ext:justify-center ext:overflow-y-auto"
  >
    <div class="ext:w-full ext:lg:w-[80%] ext:mx-8">
      <h1 class="ext:mb-8 ext:border-b" v-text="dashboard.name" />
      <div v-if="standaloneGroup.sites.length === 0 && groups.length === 0">
        {{ $gettext('No sites available') }}
      </div>
      <dashboard-group :group="standaloneGroup" :dashboard-path="dashboard.path" />

      <template v-for="group in groups" :key="group.name">
        <dashboard-group :group="group" :dashboard-path="dashboard.path" />
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import DashboardGroup from './components/DashboardGroup.vue'
import { computed } from 'vue'
import { filterVisibleSites } from './utils'
import { useGettext } from 'vue3-gettext'

import {
  ExternalSiteGroup,
  ExternalSite,
  isExternalSiteGroup,
  ExternalSiteDashboard,
  ExternalSiteOrSiteGroup
} from './types'

const { $gettext } = useGettext()

const props = defineProps<{
  dashboard: ExternalSiteDashboard
}>()

// Apply filtering to the dashboard sites
const filteredSites = computed((): ExternalSiteOrSiteGroup[] => {
  return filterVisibleSites(props.dashboard.sites || [])
})

const standaloneGroup = computed((): ExternalSiteGroup => {
  return {
    sites: filteredSites.value.filter((item) => !isExternalSiteGroup(item)) as ExternalSite[]
  }
})

const groups = computed((): ExternalSiteGroup[] => {
  return filteredSites.value.filter((item) => isExternalSiteGroup(item)) as ExternalSiteGroup[]
})
</script>
