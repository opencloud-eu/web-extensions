<template>
  <div ref="leafletElement" class="leafletContainer ext:h-[200px]" />
</template>

<script setup lang="ts">
import { ref, unref, computed, onMounted, onUnmounted } from 'vue'
import { useLeaflet, useMapPins } from '../composables'
import { useSideBar } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'

const { panelContext, applicationConfig } = defineProps<{
  panelContext: any
  applicationConfig: Record<string, any>
}>()

const { createMap } = useLeaflet()
const { onPanelActive } = useSideBar()

const leafletElement = ref<HTMLElement | null>(null)
const initialized = ref(false)
const mapObject = ref<L.Map>()

const resources = computed(() => {
  if (!panelContext || !panelContext.items) return []
  return (unref(panelContext.items.filter((r: Resource) => !!r.location)) || []) as Resource[]
})

const { setView } = useMapPins(resources, mapObject, initialized)

onMounted(() => {
  initialized.value = true
  mapObject.value = createMap(applicationConfig, unref(leafletElement))
  setView()
})

onUnmounted(() => {
  mapObject.value?.remove()
})

onPanelActive('location-details', () => {
  initialized.value = true
  setView()
})
</script>
