<template>
  <div class="ext:relative ext:flex ext:h-full ext:flex-col ext:justify-center">
    <div
      v-if="hovered"
      class="ext:pointer-events-none ext:absolute ext:-top-1 ext:z-10 ext:-translate-x-1/2 ext:-translate-y-full ext:rounded-md ext:border ext:border-role-outline-variant ext:bg-role-surface-container-highest ext:px-2.5 ext:py-1.5 ext:text-xs ext:whitespace-nowrap ext:shadow-sm"
      :style="{ left: `${hovered.centerPct}%` }"
    >
      <span class="ext:font-medium ext:text-role-on-surface">{{ hovered.label }}</span>
      <span class="ext:ml-2 ext:font-mono ext:text-role-on-surface-variant">{{
        formatCount(hovered.count, currentLanguage)
      }}</span>
    </div>

    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="ext:block ext:w-full"
      role="img"
      :aria-label="$gettext('Photos taken per month')"
      @mouseleave="hovered = null"
    >
      <line
        :x1="0"
        :y1="BASELINE"
        :x2="WIDTH"
        :y2="BASELINE"
        stroke="var(--oc-role-outline-variant)"
        stroke-width="1"
      />
      <g v-for="bar in bars" :key="bar.key">
        <rect
          :x="bar.x"
          :y="bar.y"
          :width="barWidth"
          :height="BASELINE - bar.y"
          rx="2"
          :fill="'var(--oc-role-primary)'"
          :opacity="hovered && hovered.key !== bar.key ? 0.55 : 0.9"
        />
        <text
          v-if="bar.isMax"
          :x="bar.x + barWidth / 2"
          :y="bar.y - 6"
          text-anchor="middle"
          class="ext:font-mono"
          font-size="11"
          fill="var(--oc-role-on-surface)"
        >
          {{ formatCount(bar.count, currentLanguage) }}
        </text>
        <text
          v-if="bar.axisLabel"
          :x="bar.x + barWidth / 2"
          :y="HEIGHT - 6"
          text-anchor="middle"
          font-size="10"
          fill="var(--oc-role-on-surface-variant)"
        >
          {{ bar.axisLabel }}
        </text>
        <rect
          :x="bar.x - gap / 2"
          y="0"
          :width="barWidth + gap"
          :height="BASELINE"
          fill="transparent"
          :class="bar.count > 0 ? 'ext:cursor-pointer' : ''"
          @mouseenter="hovered = bar"
          @click="bar.count > 0 && emit('select', bar.key)"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { SearchAggregation } from '../types'
import { formatCount, monthLabel, sortedMonthBuckets } from '../helpers'

const { aggregation } = defineProps<{ aggregation: SearchAggregation }>()

const emit = defineEmits<{ select: [monthKey: string] }>()

const { current: currentLanguage, $gettext } = useGettext()

const WIDTH = 720
const HEIGHT = 200
const BASELINE = 176
const TOP = 26
const gap = 8

interface Bar {
  key: string
  label: string
  count: number
  x: number
  y: number
  centerPct: number
  isMax: boolean
  axisLabel?: string
}

const buckets = computed(() => sortedMonthBuckets(aggregation))

const barWidth = computed(() => {
  const count = buckets.value.length || 1
  return (WIDTH - gap * (count + 1)) / count
})

const bars = computed<Bar[]>(() => {
  const max = Math.max(...buckets.value.map((b) => b.count), 1)
  const labeledMonths = ['01', '04', '07', '10']
  return buckets.value.map((bucket, index) => {
    const x = gap + index * (barWidth.value + gap)
    const month = bucket.key.split('-')[1]
    const isJanuary = month === '01'
    return {
      key: bucket.key,
      label: monthLabel(bucket.key, currentLanguage, true),
      count: bucket.count,
      x,
      y: BASELINE - (bucket.count / max) * (BASELINE - TOP),
      centerPct: ((x + barWidth.value / 2) / WIDTH) * 100,
      isMax: bucket.count === max,
      axisLabel: labeledMonths.includes(month)
        ? monthLabel(bucket.key, currentLanguage, isJanuary)
        : undefined
    }
  })
})

const hovered = ref<Bar | null>(null)
</script>
