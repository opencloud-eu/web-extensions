<template>
  <div :id="playerElementId" class="ext:h-full ext:w-full" />
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { getCoreName, getEmulatorPaths, getLoaderUrl } from '../emulatorAssets'
import type { ArcadeSystem } from '../roms'

interface EmulatorWindow extends Window {
  EJS_DEBUG_XX?: boolean
  EJS_disableAutoLang?: boolean
  EJS_gameUrl?: string
  EJS_core?: string
  EJS_player?: string
  EJS_paths?: Record<string, string>
  EJS_adBlocked?: (url: string, del?: boolean) => void
  EJS_emulator?: {
    pause?: (dontUpdate?: boolean) => void
    setVolume?: (volume: number) => void
  }
}

const props = defineProps<{
  system: ArcadeSystem
  url: string
}>()

const buildPlayerId = () => `arcade-emulator-${Math.random().toString(36).slice(2)}`

const playerElementId = ref(buildPlayerId())
const emulatorWindow = window as EmulatorWindow
let loaderElement: HTMLScriptElement | null = null

const initialize = () => {
  emulatorWindow.EJS_DEBUG_XX = true
  emulatorWindow.EJS_disableAutoLang = false
  emulatorWindow.EJS_gameUrl = props.url
  emulatorWindow.EJS_core = getCoreName(props.system)
  emulatorWindow.EJS_paths = getEmulatorPaths()
  emulatorWindow.EJS_player = `#${playerElementId.value}`

  loaderElement = document.createElement('script')
  loaderElement.async = true
  loaderElement.src = getLoaderUrl()
  document.body.append(loaderElement)
}

const teardown = () => {
  stopEmulator()
  loaderElement?.remove()
  loaderElement = null
  delete emulatorWindow.EJS_player
  delete emulatorWindow.EJS_gameUrl
  delete emulatorWindow.EJS_core
  delete emulatorWindow.EJS_paths
  delete emulatorWindow.EJS_adBlocked
  delete emulatorWindow.EJS_emulator
}

const stopEmulator = () => {
  const emulator = emulatorWindow.EJS_emulator

  if (!emulator) {
    return
  }

  emulator.pause?.(true)
  emulator.setVolume?.(0)
}

watch(
  () => [props.system, props.url],
  async () => {
    teardown()
    playerElementId.value = buildPlayerId()
    await nextTick()
    initialize()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  teardown()
})
</script>
