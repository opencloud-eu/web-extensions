<template>
  <div class="grid"><retro-emulator v-if="url && system" :url="url" :system="system" /></div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'

import RetroEmulator from './components/RetroEmulator.vue'
import { getRomSystem } from './roms'

const { url } = defineProps<{ url: string }>()
const system = computed(() => getRomSystem(unref(url)))
</script>
