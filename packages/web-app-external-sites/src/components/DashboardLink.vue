<template>
  <li class="tile oc-card oc-card-default oc-card-rounded">
    <a :href="site.url" target="_blank">
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
  </li>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import { ExternalSite } from '../types'

defineProps({
  site: {
    type: Object as PropType<ExternalSite>,
    required: true
  }
})
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
