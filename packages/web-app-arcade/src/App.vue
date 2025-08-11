<template>
  <div class="arcade oc-height-1-1">
    <nes-vue v-if="url" class="screen" :url="url" :label="label" :width="width" :height="height" />
  </div>
</template>
<style scoped>
.arcade {
  display: grid;
  place-items: center;
}

.screen {
  box-shadow: 0 0 60px 0 #0ff;
}
</style>

<script setup lang="ts">
import { NesVue } from 'nes-vue'

const label = '... START ...'
const width = 768
const height = 720
const { url } = defineProps({
  url: String
})
</script>
