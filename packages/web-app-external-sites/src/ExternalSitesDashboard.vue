<template>
  <main id="external-sites-dashboard" class="oc-pt-m oc-pb-l oc-flex oc-flex-center">
    <div class="page">
      <h1 class="title oc-mb-m" v-text="dashboard.name" />
      <dashboard-group :group="standaloneGroup" />

      <template v-for="group in groups" :key="group.name">
        <dashboard-group :group="group" />
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import DashboardGroup from './components/DashboardGroup.vue'
import { computed } from 'vue'
import {
  ExternalSiteGroup,
  ExternalSite,
  isExternalSiteGroup,
  ExternalSiteDashboard
} from './types'

const props = defineProps<{
  dashboard: ExternalSiteDashboard
}>()

const standaloneGroup = computed((): ExternalSiteGroup => {
  return {
    // TODO: sort by priority?
    sites: props.dashboard.sites.filter((item) => !isExternalSiteGroup(item)) as ExternalSite[]
  }
})

const groups = computed((): ExternalSiteGroup[] => {
  // TODO: sort by priority?
  return props.dashboard.sites.filter((item) => isExternalSiteGroup(item))
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
