<template>
  <div class="arcade oc-height-1-1">
    <nes-vue v-if="url" class="screen" :url="url" :label="label" :width="width" :height="height" />
  </div>
</template>

<script setup lang="ts">
import { NesVue } from 'nes-vue'
import { useGettext } from 'vue3-gettext'

const { $gettext } = useGettext()

const { url } = defineProps<{ url: string }>()

const label = $gettext('... START ...')
const width = 768
const height = 720
</script>

<style scoped>
.arcade {
  display: grid;
  place-items: center;
}

.screen {
  box-shadow: 0 0 60px 0 #0ff;
}
</style>
