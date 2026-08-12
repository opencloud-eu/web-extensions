<template>
  <div class="ext:flex ext:h-full ext:flex-col ext:bg-role-surface">
    <header
      class="ext:flex ext:flex-wrap ext:items-baseline ext:gap-x-3 ext:px-4 ext:pt-4 ext:pb-2"
    >
      <photos-breadcrumb :items="[{ text: $gettext('Timeline') }]" />
      <span v-if="total !== null" class="ext:text-sm ext:text-role-on-surface-variant">
        {{ countLabel }}
      </span>
    </header>
    <div class="ext:min-h-0 ext:flex-1 ext:px-4 ext:pb-2">
      <photo-timeline query="mediatype:image" class="ext:h-full" @loaded="total = $event" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { formatCount } from './helpers'
import PhotosBreadcrumb from './components/PhotosBreadcrumb.vue'
import PhotoTimeline from './components/PhotoTimeline.vue'

const { $ngettext, current: currentLanguage } = useGettext()

const total = ref<number | null>(null)

const countLabel = computed(() =>
  $ngettext('%{ n } photo', '%{ n } photos', total.value ?? 0, {
    n: formatCount(total.value ?? 0, currentLanguage)
  })
)
</script>
