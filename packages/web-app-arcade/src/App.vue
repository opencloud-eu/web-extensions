<template>
  <div class="grid">
    <nes-vue
      v-if="url"
      class="ext:shadow-xl ext:shadow-cyan-500"
      :url="url"
      :label="label"
      :width="width"
      :height="height"
    />
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
