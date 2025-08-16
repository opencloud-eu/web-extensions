<template>
  <h2 v-if="group.name" class="oc-flex oc-flex-middle oc-mb-s">
    {{ group.name }}
  </h2>
  <div class="link-list oc-mb-m">
    <oc-list class="links">
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

<style lang="scss" scoped>
.link-list {
  .links {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 2rem;
  }
}
</style>
