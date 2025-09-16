<template>
  <main id="external-sites-dashboard" class="oc-pt-m oc-pb-l oc-flex oc-flex-center">
    <div class="page">
      <h1 class="title oc-mb-m" v-text="dashboard.name" />
      <div v-if="standaloneGroup.sites.length === 0 && groups.length === 0">{{ $gettext('No sites available') }}</div>
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
import {
  ExternalSiteGroup,
  ExternalSite,
  isExternalSiteGroup,
  ExternalSiteDashboard,
  ExternalSiteOrSiteGroup
} from './types'

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

<style lang="scss">
#external-sites-dashboard {
  overflow-y: auto;

  .title {
    border-bottom: 0.5px solid var(--oc-role-outline-variant);
  }

  .page {
    width: 80rem;

    @media (max-width: 1200px) {
      width: 100%;
      padding-left: var(--oc-space-medium);
      padding-right: var(--oc-space-medium);
    }
  }
}
</style>
