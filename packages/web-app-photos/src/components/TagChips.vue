<template>
  <ul class="ext:m-0 ext:flex ext:list-none ext:flex-wrap ext:gap-2 ext:p-0">
    <li v-for="bucket in buckets" :key="bucket.key">
      <oc-tag size="small" :rounded="true">
        <oc-icon name="price-tag-3" size="small" fill-type="line" />
        {{ bucket.key }}
        <span class="ext:text-xs ext:text-role-on-surface-variant">
          {{ formatCount(bucket.count, currentLanguage) }}
        </span>
      </oc-tag>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { SearchAggregation } from '../types'
import { formatCount } from '../helpers'

const { aggregation } = defineProps<{ aggregation: SearchAggregation }>()

const { current: currentLanguage } = useGettext()

const buckets = computed(() => aggregation.buckets ?? [])
</script>
