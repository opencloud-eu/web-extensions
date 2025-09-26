<template>
  <oc-card class="bg-role-surface-container ext:border">
    <component :is="site.target === 'embedded' ? 'router-link' : 'a'" v-bind="linkProps">
      <div class="ext:flex ext:items-center ext:gap-4">
        <oc-icon v-if="site.icon" :name="site.icon" :color="site.color" size="large" />
        <div>
          <h3 class="ext:my-0 ext:truncate" v-text="site.name" />
          <p class="ext:my-0" v-text="site.description" />
        </div>
      </div>
    </component>
  </oc-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ExternalSite } from '../types'
import { makeSlug } from '../utils'
import { urlJoin } from '@opencloud-eu/web-client'

const props = defineProps<{
  site: ExternalSite
  dashboardPath: string
}>()

const getNestedSiteRoutePath = (site: ExternalSite): string => {
  const sitePath = makeSlug(site.name)

  return urlJoin('external-sites', props.dashboardPath, sitePath)
}

const linkProps = computed(() => {
  if (props.site.target === 'embedded') {
    return {
      to: getNestedSiteRoutePath(props.site)
    }
  }
  return {
    href: props.site.url,
    target: '_blank'
  }
})
</script>
