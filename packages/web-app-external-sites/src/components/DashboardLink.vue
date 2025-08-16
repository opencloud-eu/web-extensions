<template>
  <li class="tile oc-card oc-card-default oc-card-rounded">
    <a v-if="site.target === 'external'" :href="site.url" target="_blank">
      <div class="tile-body oc-card-body oc-p">
        <div class="tile-content oc-flex oc-flex-middle">
          <div class="tile-icon">
            <oc-icon v-if="site.icon" :name="site.icon" :color="site.color" size="xlarge" />
          </div>
          <div>
            <h3 class="oc-my-s oc-text-truncate mark-element tile-title">
              {{ site.name }}
            </h3>
            <p class="oc-my-s mark-element">{{ site.description }}</p>
          </div>
        </div>
      </div>
    </a>
    <router-link
      v-if="site.target === 'embedded'"
      :to="getNestedSiteRoutePath(site)"
      class="site-link"
    >
      <div class="tile-body oc-card-body oc-p">
        <div class="tile-content oc-flex oc-flex-middle">
          <div class="tile-icon">
            <oc-icon v-if="site.icon" :name="site.icon" :color="site.color" size="xlarge" />
          </div>
          <div>
            <h3 class="oc-my-s oc-text-truncate mark-element tile-title">
              {{ site.name }}
            </h3>
            <p class="oc-my-s mark-element">{{ site.description }}</p>
          </div>
        </div>
      </div>
    </router-link>
  </li>
</template>

<script setup lang="ts">
import { ExternalSite } from '../types'
import { makeSlug } from '../untils'

const props = defineProps<{
  site: ExternalSite
  dashboardPath: string
}>()

const getNestedSiteRoutePath = (site: ExternalSite): string => {
  const sitePath = makeSlug(site.name)

  return `/external-sites${props.dashboardPath}/${sitePath}`
}
</script>

<style lang="scss" scoped>
.tile {
  overflow: hidden;
  background-color: var(--oc-role-surface-container) !important;
  box-shadow: none;
  height: 100%;
  display: flex;
  flex-flow: column;
  outline: 0.5px solid var(--oc-role-outline-variant);

  .tile-icon {
    margin-right: var(--oc-space-medium);
  }

  .tile-body {
    display: flex;
    flex-flow: column;
    justify-content: space-between;
    height: 100%;
  }
}
</style>
