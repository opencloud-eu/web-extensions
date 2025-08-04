<template>
  <h2 v-if="group.name" class="oc-flex oc-flex-middle oc-mb-s">
    {{ group.name }}
  </h2>
  <div class="link-list oc-mb-m">
    <oc-list class="links">
      <dashboard-link v-for="site in group.sites" :key="site.name" :site="site" />
    </oc-list>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import DashboardLink from './DashboardLink.vue'
import { ExternalSiteGroup } from '../types'

defineProps({
  group: {
    type: Object as PropType<ExternalSiteGroup>,
    required: true
  }
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
