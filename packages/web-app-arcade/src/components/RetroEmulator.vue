<template>
  <iframe
    ref="frameRef"
    class="ext:h-full ext:w-full ext:border-0"
    title="Arcade Emulator"
    :srcdoc="frameDocument"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, unref } from 'vue'

import { getCoreName, getEmulatorPaths, getLoaderUrl } from '../emulatorAssets'
import type { ArcadeSystem } from '../roms'
import frameTemplate from './retro-emulator-frame.html?raw'

const props = defineProps<{
  system: ArcadeSystem
  url: string
}>()

const frameRef = ref<HTMLIFrameElement | null>(null)
const frameDocument = computed(() =>
  frameTemplate
    .replace('__EJS_CORE__', JSON.stringify(getCoreName(unref(props.system))))
    .replace('__EJS_GAME_URL__', JSON.stringify(unref(props.url)))
    .replace('__EJS_PATHS__', JSON.stringify(getEmulatorPaths()))
    .replace('__EJS_LOADER_URL__', getLoaderUrl())
)

onBeforeUnmount(() => {
  if (unref(frameRef)) {
    unref(frameRef).srcdoc = ''
    unref(frameRef).remove()
  }
})
</script>
